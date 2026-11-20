import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import { workflowRepository } from '../src/repositories/workflow.repository.js';

describe('Day 8: Visual Workflow Dependency Resolution API Endpoint Tests', () => {
  let mockWorkflowStore = [];

  before(() => {
    mockWorkflowStore = [];
    workflowRepository.setStore(mockWorkflowStore);
  });

  after(() => {
    workflowRepository.resetStore();
  });

  beforeEach(() => {
    mockWorkflowStore.length = 0;
  });

  // --------------------------------------------------------------------------
  // 1. POST /api/workflows/resolve
  // --------------------------------------------------------------------------
  it('POST /api/workflows/resolve returns 200 and complete execution plan for valid graph', async () => {
    const payload = {
      nodes: [
        {
          id: 'temp_1',
          type: 'temperatureSensor',
          position: { x: 100, y: 100 },
          config: { sensorId: 'turbine-sensor-01' },
        },
        {
          id: 'thresh_1',
          type: 'threshold',
          position: { x: 300, y: 100 },
          config: { operator: '>', threshold: 85.0 },
        },
        {
          id: 'sms_1',
          type: 'smsAlert',
          position: { x: 500, y: 100 },
          config: { recipient: '+15550199', message: 'Temp alert' },
        },
      ],
      edges: [
        { source: 'temp_1', target: 'thresh_1' },
        { source: 'thresh_1', target: 'sms_1' },
      ],
    };

    const res = await request(app)
      .post('/api/workflows/resolve')
      .send(payload)
      .expect(200);

    assert.equal(res.body.success, true);
    assert.equal(res.body.statusCode, 200);
    assert.ok(res.body.data.topologicalOrder);
    assert.deepEqual(res.body.data.topologicalOrder, ['temp_1', 'thresh_1', 'sms_1']);
    assert.equal(res.body.data.executionStages.length, 3);
    assert.equal(res.body.data.pipelines.length, 1);
    assert.equal(res.body.data.metadata.activeNodesCount, 3);
  });

  it('POST /api/workflows/resolve prunes disconnected nodes under default strategy', async () => {
    const payload = {
      nodes: [
        { id: 's1', type: 'dataSource', config: { sensorId: 's-1' } },
        { id: 'a1', type: 'smsAlert', config: { recipient: '+1555' } },
        { id: 'unconnected_node', type: 'math', config: { operator: '>', threshold: 5 } },
      ],
      edges: [{ source: 's1', target: 'a1' }],
    };

    const res = await request(app)
      .post('/api/workflows/resolve')
      .send(payload)
      .expect(200);

    assert.equal(res.body.success, true);
    assert.deepEqual(res.body.data.topologicalOrder, ['s1', 'a1']);
    assert.equal(res.body.data.prunedNodes.length, 1);
    assert.equal(res.body.data.prunedNodes[0].id, 'unconnected_node');
  });

  it('POST /api/workflows/resolve rejects cycle with 400 Bad Request', async () => {
    const payload = {
      nodes: [
        { id: 's1', type: 'dataSource', config: { sensorId: 's-1' } },
        { id: 'm1', type: 'movingAverage', config: { windowSize: 5 } },
        { id: 'm2', type: 'threshold', config: { operator: '>', threshold: 10 } },
        { id: 'a1', type: 'action', config: { recipient: '+1' } },
      ],
      edges: [
        { source: 's1', target: 'm1' },
        { source: 'm1', target: 'm2' },
        { source: 'm2', target: 'm1' }, // Cycle
        { source: 'm2', target: 'a1' },
      ],
    };

    const res = await request(app)
      .post('/api/workflows/resolve')
      .send(payload)
      .expect(400);

    assert.equal(res.body.success, false);
    assert.equal(res.body.statusCode, 400);
    assert.match(res.body.message, /Workflow dependency resolution failed/);
  });

  // --------------------------------------------------------------------------
  // 2. GET /api/workflows/:id/resolve
  // --------------------------------------------------------------------------
  it('GET /api/workflows/:id/resolve resolves execution plan for saved workflow', async () => {
    const saved = await workflowRepository.createWorkflow({
      name: 'Production Flow for Resolution',
      nodes: [
        {
          id: 'temp_sensor',
          type: 'temperatureSensor',
          config: { sensorId: 'sensor-88' },
        },
        {
          id: 'filter',
          type: 'movingAverage',
          config: { windowSize: 5 },
        },
        {
          id: 'webhook_sink',
          type: 'webhook',
          config: { url: 'https://api.corp.org/dispatch' },
        },
      ],
      edges: [
        { source: 'temp_sensor', target: 'filter' },
        { source: 'filter', target: 'webhook_sink' },
      ],
    });

    const res = await request(app)
      .get(`/api/workflows/${saved.id}/resolve`)
      .expect(200);

    assert.equal(res.body.success, true);
    assert.equal(res.body.data.workflowId, saved.id);
    assert.deepEqual(res.body.data.topologicalOrder, [
      'temp_sensor',
      'filter',
      'webhook_sink',
    ]);
    assert.equal(res.body.data.pipelines.length, 1);
  });

  it('GET /api/workflows/:id/resolve returns 404 for non-existent ID', async () => {
    const res = await request(app)
      .get('/api/workflows/non_existent_id/resolve')
      .expect(404);

    assert.equal(res.body.success, false);
  });
});
