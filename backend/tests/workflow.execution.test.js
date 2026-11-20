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

import app from "../src/app.js";
import { workflowRepository } from "../src/repositories/workflow.repository.js";
import {
  executionHistoryRepository,
} from "../src/repositories/executionHistory.repository.js";

describe("Workflow Execution API", () => {
  const mockWorkflowStore = [];
  const mockExecutionStore = [];
  const originalGetLatestTelemetry =
    telemetryService.getLatestTelemetry.bind(telemetryService);

  before(() => {
    workflowRepository.setStore(mockWorkflowStore);
    executionHistoryRepository.setStore(mockExecutionStore);
  });

  after(() => {
    workflowRepository.resetStore();
    executionHistoryRepository.resetStore();
    telemetryService.getLatestTelemetry =
      originalGetLatestTelemetry;
  });

  beforeEach(() => {
    mockWorkflowStore.length = 0;
    mockExecutionStore.length = 0;

    telemetryService.getLatestTelemetry = async (sensorId) => ({
      _id: "mock-turbine-telemetry",
      timestamp: new Date("2026-11-20T06:00:00.000Z"),
      metadata: { sensorId },
      value: 65,
      unit: "°C",
    });
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