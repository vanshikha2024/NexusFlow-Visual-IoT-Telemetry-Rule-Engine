import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import { workflowRepository } from '../src/repositories/workflow.repository.js';

describe('Day 7: Visual Workflow Validation API Endpoint Tests', () => {
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
  // 1. POST /api/workflows/validate
  // --------------------------------------------------------------------------
  it('POST /api/workflows/validate returns 200 and topological order for valid graph', async () => {
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
      .post('/api/workflows/validate')
      .send(payload)
      .expect(200);

    assert.equal(res.body.success, true);
    assert.equal(res.body.statusCode, 200);
    assert.equal(res.body.data.isValid, true);
    assert.deepEqual(res.body.data.topologicalOrder, ['temp_1', 'thresh_1', 'sms_1']);
    assert.equal(res.body.data.summary.totalNodes, 3);
    assert.equal(res.body.data.summary.totalEdges, 2);
  });

  it('POST /api/workflows/validate returns 400 when cycle is present in submitted graph', async () => {
    const payload = {
      nodes: [
        { id: 's1', type: 'dataSource', config: { sensorId: 's-1' } },
        { id: 'm1', type: 'threshold', config: { operator: '>', threshold: 10 } },
        { id: 'm2', type: 'threshold', config: { operator: '<', threshold: 5 } },
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
      .post('/api/workflows/validate')
      .send(payload)
      .expect(400);

    assert.equal(res.body.success, false);
    assert.equal(res.body.statusCode, 400);
    const cycleErr = res.body.errors.find((e) => e.code === 'CYCLE_DETECTED');
    assert.ok(cycleErr, 'Expected CYCLE_DETECTED error code');
    assert.match(cycleErr.message, /m1 -> m2 -> m1/);
  });

  it('POST /api/workflows/validate returns 400 when dangling edges or unsupported types are present', async () => {
    const payload = {
      nodes: [
        { id: 's1', type: 'unsupportedNodeType', config: {} },
      ],
      edges: [
        { source: 's1', target: 'non_existent_node' },
      ],
    };

    const res = await request(app)
      .post('/api/workflows/validate')
      .send(payload)
      .expect(400);

    assert.equal(res.body.success, false);
    const typeErr = res.body.errors.find((e) => e.code === 'UNSUPPORTED_NODE_TYPE');
    const edgeErr = res.body.errors.find((e) => e.code === 'INVALID_EDGE_REFERENCE');
    assert.ok(typeErr);
    assert.ok(edgeErr);
  });

  // --------------------------------------------------------------------------
  // 2. GET /api/workflows/:id/validate
  // --------------------------------------------------------------------------
  it('GET /api/workflows/:id/validate validates a saved workflow from repository', async () => {
    const saved = await workflowRepository.createWorkflow({
      name: 'Production Flow for Validation',
      nodes: [
        {
          id: 'temp_sensor',
          type: 'temperatureSensor',
          config: { sensorId: 'sensor-99' },
        },
        {
          id: 'filter',
          type: 'movingAverage',
          config: { windowSize: 10 },
        },
        {
          id: 'webhook_out',
          type: 'webhook',
          config: { url: 'https://api.domain.com/alert' },
        },
      ],
      edges: [
        { source: 'temp_sensor', target: 'filter' },
        { source: 'filter', target: 'webhook_out' },
      ],
    });

    const res = await request(app)
      .get(`/api/workflows/${saved.id}/validate`)
      .expect(200);

    assert.equal(res.body.success, true);
    assert.equal(res.body.data.workflowId, saved.id);
    assert.equal(res.body.data.isValid, true);
    assert.deepEqual(res.body.data.topologicalOrder, [
      'temp_sensor',
      'filter',
      'webhook_out',
    ]);
  });

  it('GET /api/workflows/:id/validate returns 404 for non-existent workflow ID', async () => {
    const res = await request(app)
      .get('/api/workflows/non_existent_id/validate')
      .expect(404);

    assert.equal(res.body.success, false);
  });
});
