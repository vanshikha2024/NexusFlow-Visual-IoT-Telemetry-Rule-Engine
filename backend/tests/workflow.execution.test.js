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

import app from "../src/app.js";
import { workflowRepository } from "../src/repositories/workflow.repository.js";
import {
  executionHistoryRepository,
} from "../src/repositories/executionHistory.repository.js";

describe("Workflow Execution API", () => {
  const mockWorkflowStore = [];
const mockExecutionStore = [];

let mockTelemetryValue = 65;
const mockTelegramMessages = [];

const originalGetLatestTelemetry =
  telemetryService.getLatestTelemetry.bind(telemetryService);

const originalSendMessage =
  telegramService.sendMessage.bind(telegramService);

  before(() => {
    workflowRepository.setStore(mockWorkflowStore);
    executionHistoryRepository.setStore(mockExecutionStore);
  });

  after(() => {
    workflowRepository.resetStore();
    executionHistoryRepository.resetStore();
    telemetryService.getLatestTelemetry =
      originalGetLatestTelemetry;
    telegramService.sendMessage = originalSendMessage;
  });

 beforeEach(() => {
  mockWorkflowStore.length = 0;
  mockExecutionStore.length = 0;
  mockTelegramMessages.length = 0;

  mockTelemetryValue = 65;

  telemetryService.getLatestTelemetry = async (sensorId) => ({
    _id: "mock-turbine-telemetry",
    timestamp: new Date("2026-11-20T06:00:00.000Z"),
    metadata: { sensorId },
    value: mockTelemetryValue,
    unit: "°C",
  });

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
});