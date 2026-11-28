import {
  describe,
  it,
  before,
  after,
  beforeEach,
} from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { telemetryService } from "../src/services/telemetry.service.js";
import { telegramService } from "../src/services/telegram.service.js";
import { webhookService } from "../src/services/webhook.service.js";
import app from "../src/app.js";
import { workflowRepository } from "../src/repositories/workflow.repository.js";
import {
  executionHistoryRepository,
} from "../src/repositories/executionHistory.repository.js";

describe("Workflow Execution API", () => {
  const mockWorkflowStore = [];
  const mockExecutionStore = [];

  let mockTelemetryValue = 65;
  let mockTelemetryMissing = false;
  const mockTelegramMessages = [];
  const mockWebhookCalls = [];

  const originalSendWebhook = webhookService.sendWebhook;

  const originalGetLatestTelemetry = telemetryService.getLatestTelemetry.bind(telemetryService);
  const originalGetTelemetryBySensor = telemetryService.getTelemetryBySensor.bind(telemetryService);

  const originalSendMessage = telegramService.sendMessage.bind(telegramService);

  before(() => {
    workflowRepository.setStore(mockWorkflowStore);
    executionHistoryRepository.setStore(mockExecutionStore);
  });

  after(() => {
    workflowRepository.resetStore();
    executionHistoryRepository.resetStore();
    telemetryService.getLatestTelemetry = originalGetLatestTelemetry;
    telemetryService.getTelemetryBySensor = originalGetTelemetryBySensor;
    telegramService.sendMessage = originalSendMessage;
    webhookService.sendWebhook = originalSendWebhook;
  });

 
  beforeEach(() => {
    mockWorkflowStore.length = 0;
    mockExecutionStore.length = 0;
    mockTelegramMessages.length = 0;

    mockTelemetryValue = 65;
    mockTelemetryMissing = false;

    telemetryService.getLatestTelemetry = async (sensorId) => {
      if (mockTelemetryMissing) {
        return null;
      }

      return {
        _id: "mock-turbine-telemetry",
        timestamp: new Date("2026-11-20T06:00:00.000Z"),
        metadata: { sensorId },
        value: mockTelemetryValue,
        unit: "°C",
      };
    };

    telemetryService.getTelemetryBySensor = originalGetTelemetryBySensor;

    telegramService.sendMessage = async (message) => {
      mockTelegramMessages.push(message);

      return {
        delivered: true,
        channel: "telegram",
        chatId: "test-chat",
        messageId: 123,
        date: 1795161514,
      };
    };
    mockWebhookCalls.length = 0;

    webhookService.sendWebhook = async (options) => {
      mockWebhookCalls.push(options);

      return {
        delivered: true,
        hostname: "hooks.example.com",
        method: options.method,
        statusCode: 200,
        response: { success: true },
      };
    };
  });

  it("executes a valid sensor-to-threshold-to-SMS workflow", async () => {
    const workflow = await workflowRepository.createWorkflow({
      name: "Execution Test Workflow",
      nodes: [
        {
          id: "sensor",
          type: "dataSource",
          label: "Turbine Sensor",
          config: { sensorId: "turbine-01" },
        },
        {
          id: "threshold",
          type: "math",
          label: "Threshold",
          config: { operator: ">", threshold: 50 },
        },
        {
          id: "sms",
          type: "action",
          label: "SMS Alert",
          config: {
            recipient: "+15550199",
            message: "Temperature alert",
          },
        },
      ],
      edges: [
        { source: "sensor", target: "threshold" },
        { source: "threshold", target: "sms" },
      ],
    });

    const response = await request(app)
      .post(`/api/workflows/${workflow.id}/execute`)
      .expect(200);

    assert.equal(response.body.success, true);
    assert.equal(response.body.data.status, "completed");
    assert.equal(response.body.data.mode, "simulation");

    assert.equal(response.body.data.results.sensor, 65);
    assert.equal(response.body.data.results.threshold, true);
    assert.equal(
      response.body.data.results.sms.phone,
      "+15550199"
    );

    assert.equal(response.body.data.executionLog.length, 3);
    assert.ok(response.body.data.historyId);

    assert.equal(mockExecutionStore.length, 1);
    assert.equal(mockExecutionStore[0].status, "completed");
  });

it("sends a Telegram alert when the threshold is true", async () => {
  const workflow = await workflowRepository.createWorkflow({
    name: "Telegram Alert Test",
    nodes: [
      {
        id: "sensor",
        type: "dataSource",
        label: "Turbine Sensor",
        config: { sensorId: "turbine-01" },
      },
      {
        id: "threshold",
        type: "math",
        label: "Threshold",
        config: { operator: ">", threshold: 50 },
      },
      {
        id: "telegram",
        type: "action",
        label: "Telegram Alert",
        config: { message: "Turbine temperature is high" },
      },
    ],
    edges: [
      { source: "sensor", target: "threshold" },
      { source: "threshold", target: "telegram" },
    ],
  });

  const response = await request(app)
    .post(`/api/workflows/${workflow.id}/execute`)
    .expect(200);

  assert.equal(response.body.data.status, "completed");
  assert.equal(response.body.data.mode, "live");
  assert.equal(response.body.data.results.telegram.delivered, true);
  assert.equal(response.body.data.results.telegram.channel, "telegram");
  assert.equal(mockTelegramMessages.length, 1);
  assert.match(mockTelegramMessages[0], /Turbine temperature is high/);

  assert.equal(mockExecutionStore[0].mode, "live");
});

it("skips Telegram delivery when the threshold is false", async () => {
  mockTelemetryValue = 40;

  const workflow = await workflowRepository.createWorkflow({
    name: "Telegram Skip Test",
    nodes: [
      {
        id: "sensor",
        type: "dataSource",
        label: "Turbine Sensor",
        config: { sensorId: "turbine-01" },
      },
      {
        id: "threshold",
        type: "math",
        label: "Threshold",
        config: { operator: ">", threshold: 50 },
      },
      {
        id: "telegram",
        type: "action",
        label: "Telegram Alert",
        config: { message: "Turbine temperature is high" },
      },
    ],
    edges: [
      { source: "sensor", target: "threshold" },
      { source: "threshold", target: "telegram" },
    ],
  });

  const response = await request(app)
    .post(`/api/workflows/${workflow.id}/execute`)
    .expect(200);

  assert.equal(response.body.data.results.threshold, false);
  assert.equal(response.body.data.results.telegram.delivered, false);
  assert.equal(response.body.data.results.telegram.skipped, true);
  assert.equal(mockTelegramMessages.length, 0);
  assert.equal(mockExecutionStore[0].status, "completed");
});

it("sends a webhook when the upstream threshold is true", async () => {
  const workflow = await workflowRepository.createWorkflow({
    name: "Webhook Execution Test",
    nodes: [
      {
        id: "sensor",
        type: "dataSource",
        label: "Turbine Sensor",
        config: { sensorId: "turbine-01" },
      },
      {
        id: "threshold",
        type: "math",
        label: "Threshold",
        config: { operator: ">", threshold: 50 },
      },
      {
        id: "webhook",
        type: "action",
        label: "Webhook",
        config: {
          url: "https://hooks.example.com/nexusflow",
          method: "POST",
        },
      },
    ],
    edges: [
      { source: "sensor", target: "threshold" },
      { source: "threshold", target: "webhook" },
    ],
  });

  const response = await request(app)
    .post(`/api/workflows/${workflow.id}/execute`)
    .expect(200);

  assert.equal(response.body.success, true);
  assert.equal(response.body.data.status, "completed");
  assert.equal(response.body.data.mode, "live");

  assert.equal(response.body.data.results.webhook.delivered, true);
  assert.equal(response.body.data.results.webhook.statusCode, 200);

  assert.equal(mockWebhookCalls.length, 1);
  assert.equal(
    mockWebhookCalls[0].url,
    "https://hooks.example.com/nexusflow"
  );
  assert.equal(mockWebhookCalls[0].method, "POST");

  assert.equal(mockWebhookCalls[0].payload.nodeId, "webhook");
  assert.deepEqual(mockWebhookCalls[0].payload.inputs, [true]);

  assert.equal(mockExecutionStore.length, 1);
  assert.equal(mockExecutionStore[0].status, "completed");
  assert.equal(mockExecutionStore[0].mode, "live");
});

it("skips webhook delivery when the upstream threshold is false", async () => {
  mockTelemetryValue = 40;

  const workflow = await workflowRepository.createWorkflow({
    name: "Webhook Skip Test",
    nodes: [
      {
        id: "sensor",
        type: "dataSource",
        label: "Turbine Sensor",
        config: { sensorId: "turbine-01" },
      },
      {
        id: "threshold",
        type: "math",
        label: "Threshold",
        config: { operator: ">", threshold: 50 },
      },
      {
        id: "webhook",
        type: "action",
        label: "Webhook",
        config: {
          url: "https://hooks.example.com/nexusflow",
          method: "POST",
        },
      },
    ],
    edges: [
      { source: "sensor", target: "threshold" },
      { source: "threshold", target: "webhook" },
    ],
  });

  const response = await request(app)
    .post(`/api/workflows/${workflow.id}/execute`)
    .expect(200);

  assert.equal(response.body.data.status, "completed");
  assert.equal(response.body.data.results.threshold, false);
  assert.equal(response.body.data.results.webhook.delivered, false);
  assert.equal(response.body.data.results.webhook.skipped, true);

  assert.equal(mockWebhookCalls.length, 0);
  assert.equal(mockExecutionStore[0].status, "completed");
});

  it("rejects an invalid graph and records failed execution history", async () => {
    const workflow = await workflowRepository.createWorkflow({
      name: "Invalid Execution Workflow",
      nodes: [
        {
          id: "sensor",
          type: "dataSource",
          label: "Turbine Sensor",
          config: { sensorId: "turbine-01" },
        },
        {
          id: "sms",
          type: "action",
          label: "SMS Alert",
          config: {
            recipient: "+15550199",
            message: "Test",
          },
        },
      ],
      edges: [
        { source: "sensor", target: "missing-node" },
      ],
    });

    const response = await request(app)
      .post(`/api/workflows/${workflow.id}/execute`)
      .expect(400);

    assert.equal(response.body.success, false);
    assert.match(
      response.body.message,
      /validation failed|invalid|dangling/i
    );

    assert.equal(mockExecutionStore.length, 1);
    assert.equal(mockExecutionStore[0].status, "failed");
    assert.match(
      mockExecutionStore[0].error,
      /validation failed|invalid|dangling/i
    );
  });

  it("records failed execution history when telemetry is missing", async () => {
    mockTelemetryMissing = true;

    const workflow = await workflowRepository.createWorkflow({
      name: "Runtime Telemetry Failure Test",
      nodes: [
        {
          id: "sensor",
          type: "dataSource",
          label: "Turbine Sensor",
          config: { sensorId: "missing-sensor-999" },
        },
        {
          id: "threshold",
          type: "math",
          label: "Threshold",
          config: { operator: ">", threshold: 50 },
        },
        {
          id: "sms",
          type: "action",
          label: "SMS Alert",
          config: {
            recipient: "+15550199",
            message: "Test failure",
          },
        },
      ],
      edges: [
        { source: "sensor", target: "threshold" },
        { source: "threshold", target: "sms" },
      ],
    });

    const response = await request(app)
      .post(`/api/workflows/${workflow.id}/execute`)
      .expect(404);

    assert.equal(response.body.success, false);

    assert.match(
      response.body.message,
      /No telemetry records found.*missing-sensor-999/i
    );

    assert.equal(mockExecutionStore.length, 1);

    const history = mockExecutionStore[0];

    assert.equal(history.status, "failed");

    assert.match(
      history.error,
      /No telemetry records found.*missing-sensor-999/i
    );

    assert.equal(history.executionLog.length, 1);
    assert.equal(history.executionLog[0].nodeId, "sensor");
    assert.equal(history.executionLog[0].status, "failed");

    assert.match(
      history.executionLog[0].error,
      /missing-sensor-999/
    );
  });

  it("calculates Moving Average using the latest historical telemetry samples", async () => {
    telemetryService.getTelemetryBySensor = async (sensorId, options) => {
      assert.equal(sensorId, "turbine-01");
      assert.equal(options.limit, 3);

      return [
        { value: 90, timestamp: new Date("2026-11-23T10:03:00.000Z") },
        { value: 80, timestamp: new Date("2026-11-23T10:02:00.000Z") },
        { value: 70, timestamp: new Date("2026-11-23T10:01:00.000Z") },
      ];
    };

    const workflow = await workflowRepository.createWorkflow({
      name: "Moving Average Test",
      nodes: [
        {
          id: "sensor",
          type: "dataSource",
          label: "Turbine Sensor",
          config: { sensorId: "turbine-01" },
        },
        {
          id: "average",
          type: "math",
          label: "Moving Average",
          config: { windowSize: 3 },
        },
        {
          id: "threshold",
          type: "math",
          label: "Threshold",
          config: { operator: ">", threshold: 75 },
        },
        {
          id: "sms",
          type: "action",
          label: "SMS Alert",
          config: {
            recipient: "+15550199",
            message: "Moving average alert",
          },
        },
      ],
      edges: [
        { source: "sensor", target: "average" },
        { source: "average", target: "threshold" },
        { source: "threshold", target: "sms" },
      ],
    });

    const response = await request(app)
      .post(`/api/workflows/${workflow.id}/execute`)
      .expect(200);

    assert.equal(response.body.data.status, "completed");
    assert.equal(response.body.data.results.average, 80);
    assert.equal(response.body.data.results.threshold, true);
    assert.equal(response.body.data.results.sms.triggered, true);
    assert.equal(response.body.data.executionLog.length, 4);
    assert.equal(mockExecutionStore[0].status, "completed");
  });

});