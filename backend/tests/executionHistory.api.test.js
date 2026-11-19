import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import app from '../src/app.js';
import { executionHistoryRepository } from '../src/repositories/executionHistory.repository.js';
import { workflowRepository } from '../src/repositories/workflow.repository.js';

describe('Execution History API', () => {
  const mockExecutionStore = [];
  const mockWorkflowStore = [];

  const workflowId = 'wf_test_123';

  const createExecution = (id, executedAt, status = 'completed', targetWorkflowId = workflowId) => ({
    id,
    workflowId: targetWorkflowId,
    workflowName: 'Test Workflow',
    status,
    mode: 'simulation',
    results: { temperature: 65 },
    executionLog: [
      {
        nodeId: 'sensor_1',
        nodeName: 'Temperature Sensor',
        output: 65,
        status: 'success',
      },
    ],
    executedAt: new Date(executedAt),
  });

  before(() => {
    executionHistoryRepository.setStore(mockExecutionStore);
    workflowRepository.setStore(mockWorkflowStore);
  });

  after(() => {
    executionHistoryRepository.resetStore();
    workflowRepository.resetStore();
  });

  beforeEach(() => {
    mockExecutionStore.length = 0;
    mockWorkflowStore.length = 0;

    mockWorkflowStore.push({
      id: workflowId,
      _id: workflowId,
      name: 'Test Workflow',
    });

    mockWorkflowStore.push({
      id: 'wf_other_456',
      _id: 'wf_other_456',
      name: 'Other Workflow',
    });
  });

  describe('GET /api/execution-history', () => {
    it('should return recent execution history', async () => {
      await executionHistoryRepository.createExecution(
        createExecution('execution_1', '2026-11-18T10:00:00Z')
      );

      await executionHistoryRepository.createExecution(
        createExecution('execution_2', '2026-11-18T11:00:00Z', 'failed')
      );

      const response = await request(app)
        .get('/api/execution-history');

      assert.equal(response.statusCode, 200);
      assert.equal(response.body.success, true);
      assert.equal(response.body.data.count, 2);
      assert.equal(response.body.data.executions.length, 2);
      assert.equal(response.body.data.executions[0].id, 'execution_2');
    });

    it('should support limit and skip pagination', async () => {
      await executionHistoryRepository.createExecution(
        createExecution('execution_1', '2026-11-18T10:00:00Z')
      );

      await executionHistoryRepository.createExecution(
        createExecution('execution_2', '2026-11-18T11:00:00Z')
      );

      await executionHistoryRepository.createExecution(
        createExecution('execution_3', '2026-11-18T12:00:00Z')
      );

      const response = await request(app)
        .get('/api/execution-history?limit=1&skip=1');

      assert.equal(response.statusCode, 200);
      assert.equal(response.body.success, true);
      assert.equal(response.body.data.count, 3);
      assert.equal(response.body.data.executions.length, 1);
      assert.equal(response.body.data.executions[0].id, 'execution_2');
    });
  });

  describe('GET /api/execution-history/workflow/:workflowId', () => {
    it('should return history for the requested workflow only', async () => {
      await executionHistoryRepository.createExecution(
        createExecution('execution_1', '2026-11-18T10:00:00Z')
      );

      await executionHistoryRepository.createExecution(
        createExecution('execution_2', '2026-11-18T11:00:00Z')
      );

      await executionHistoryRepository.createExecution(
        createExecution(
          'execution_3',
          '2026-11-18T12:00:00Z',
          'completed',
          'wf_other_456'
        )
      );

      const response = await request(app)
        .get(`/api/execution-history/workflow/${workflowId}`);

      assert.equal(response.statusCode, 200);
      assert.equal(response.body.success, true);
      assert.equal(response.body.data.count, 2);
      assert.equal(response.body.data.executions.length, 2);

      for (const execution of response.body.data.executions) {
        assert.equal(execution.workflowId, workflowId);
      }
    });

    it('should return 404 for a workflow that does not exist', async () => {
      const response = await request(app)
        .get('/api/execution-history/workflow/unknown_workflow');

      assert.equal(response.statusCode, 404);
    });
  });

  describe('GET /api/execution-history/:id', () => {
    it('should return execution details by ID', async () => {
      await executionHistoryRepository.createExecution(
        createExecution('execution_details_1', '2026-11-18T10:00:00Z')
      );

      const response = await request(app)
        .get('/api/execution-history/execution_details_1');

      assert.equal(response.statusCode, 200);
      assert.equal(response.body.success, true);
      assert.equal(response.body.data.id, 'execution_details_1');
      assert.equal(response.body.data.workflowName, 'Test Workflow');
      assert.equal(response.body.data.status, 'completed');
    });

    it('should return 404 when execution ID does not exist', async () => {
      const response = await request(app)
        .get('/api/execution-history/unknown_execution');

      assert.equal(response.statusCode, 404);
    });
  });
});