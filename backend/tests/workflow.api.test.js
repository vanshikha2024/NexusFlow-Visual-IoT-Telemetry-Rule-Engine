import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import { workflowRepository } from '../src/repositories/workflow.repository.js';
import { telemetryRepository } from '../src/repositories/telemetry.repository.js';

describe('Day 6: Visual Workflow API & Graph JSON Contract Tests', () => {
  let mockWorkflowStore = [];
  let mockTelemetryStore = [];

  before(() => {
    // Inject mock stores so tests run deterministically without requiring external MongoDB daemon
    mockWorkflowStore = [];
    workflowRepository.setStore(mockWorkflowStore);

    mockTelemetryStore = [];
    telemetryRepository.setCollection({
      insertOne: async (doc) => {
        mockTelemetryStore.push(doc);
        return { acknowledged: true, insertedId: 'mock_telem_id' };
      },
    });
  });

  after(() => {
    workflowRepository.resetStore();
    telemetryRepository.resetCollection();
  });

  beforeEach(() => {
    mockWorkflowStore.length = 0;
    mockTelemetryStore.length = 0;
  });

  // --------------------------------------------------------------------------
  // 1. POST /api/workflows - Creation & Validation
  // --------------------------------------------------------------------------
  it('POST /api/workflows successfully creates and persists a valid visual workflow', async () => {
    const payload = {
      name: 'Turbine Overheat & Pressure Protection',
      description: 'Trigger SMS alert and webhook when turbine temperature or pressure exceeds threshold',
      status: 'active',
      nodes: [
        {
          id: 'node_sensor_temp',
          type: 'dataSource',
          label: 'Turbine Sensor',
          position: { x: 100, y: 150 },
          data: { label: 'Turbine Sensor', category: 'Data Source', color: '#0ea5e9' },
          config: { sensorId: 'turbine-sensor-01', metric: 'temperature' },
        },
        {
          id: 'node_math_thresh',
          type: 'math',
          label: 'Threshold Filter',
          position: { x: 360, y: 150 },
          data: { label: 'Threshold', category: 'Math Operation', color: '#8b5cf6' },
          config: { operator: '>', threshold: 85.0 },
        },
        {
          id: 'node_action_sms',
          type: 'action',
          label: 'SMS Alert',
          position: { x: 620, y: 150 },
          data: { label: 'SMS Alert', category: 'Action Trigger', color: '#ef4444' },
          config: { recipient: '+15550199', message: 'CRITICAL: Turbine Temperature > 85┬░C' },
        },
      ],
      edges: [
        {
          id: 'edge_temp_to_thresh',
          source: 'node_sensor_temp',
          target: 'node_math_thresh',
          sourceHandle: 'right',
          targetHandle: 'left',
          animated: true,
        },
        {
          id: 'edge_thresh_to_sms',
          source: 'node_math_thresh',
          target: 'node_action_sms',
          sourceHandle: 'right',
          targetHandle: 'left',
          animated: true,
        },
      ],
      metadata: { author: 'Ankit Singh', tags: ['turbine', 'safety'] },
    };

    const res = await request(app)
      .post('/api/workflows')
      .send(payload)
      .expect('Content-Type', /json/)
      .expect(201);

    assert.equal(res.body.success, true);
    assert.equal(res.body.statusCode, 201);
    assert.ok(res.body.data.id, 'Expected generated workflow ID');
    assert.equal(res.body.data.name, 'Turbine Overheat & Pressure Protection');
    assert.equal(res.body.data.version, 1);
    assert.equal(res.body.data.status, 'active');
    assert.equal(res.body.data.nodes.length, 3);
    assert.equal(res.body.data.edges.length, 2);

    // Verify coordinates and configuration were preserved
    assert.deepEqual(res.body.data.nodes[0].position, { x: 100, y: 150 });
    assert.equal(res.body.data.nodes[0].config.sensorId, 'turbine-sensor-01');
    assert.equal(res.body.data.edges[0].source, 'node_sensor_temp');
    assert.equal(res.body.data.edges[0].target, 'node_math_thresh');

    // Verify stored in mock store
    assert.equal(mockWorkflowStore.length, 1);
    assert.equal(mockWorkflowStore[0].name, payload.name);

    // Verify telemetry store remains untouched (strict isolation)
    assert.equal(mockTelemetryStore.length, 0);
  });

  it('POST /api/workflows accepts fine-grained node type names (temperatureSensor, humidity, webhook)', async () => {
    const payload = {
      name: 'Humidity Regulation Flow',
      nodes: [
        {
          id: 'h_sensor',
          type: 'humiditySensor',
          position: { x: 50, y: 100 },
          config: { sensorId: 'humidity-sensor-01', unit: '%' },
        },
        {
          id: 'avg_filter',
          type: 'movingAverage',
          position: { x: 250, y: 100 },
          config: { windowSize: 10 },
        },
        {
          id: 'wh_action',
          type: 'webhook',
          position: { x: 450, y: 100 },
          config: { url: 'https://iot.company.org/webhook' },
        },
      ],
      edges: [
        { source: 'h_sensor', target: 'avg_filter' },
        { source: 'avg_filter', target: 'wh_action' },
      ],
    };

    const res = await request(app)
      .post('/api/workflows')
      .send(payload)
      .expect(201);

    assert.equal(res.body.success, true);
    assert.equal(res.body.data.nodes[0].type, 'humiditySensor');
    assert.equal(res.body.data.nodes[1].type, 'movingAverage');
    assert.equal(res.body.data.nodes[2].type, 'webhook');
  });

  it('POST /api/workflows rejects missing or empty workflow name with 400', async () => {
    const res = await request(app)
      .post('/api/workflows')
      .send({
        nodes: [{ id: 'n1', type: 'dataSource' }],
      })
      .expect(400);

    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Workflow validation failed/);
    const err = res.body.errors.find((e) => e.field === 'name');
    assert.ok(err, 'Expected error on field "name"');
  });

  it('POST /api/workflows rejects missing or empty nodes array with 400', async () => {
    const res = await request(app)
      .post('/api/workflows')
      .send({
        name: 'Empty Workflow',
        nodes: [],
      })
      .expect(400);

    assert.equal(res.body.success, false);
    const err = res.body.errors.find((e) => e.field === 'nodes');
    assert.ok(err, 'Expected error on field "nodes"');
  });

  it('POST /api/workflows rejects duplicate node IDs with 400', async () => {
    const payload = {
      name: 'Duplicate Node Flow',
      nodes: [
        { id: 'node_dup', type: 'dataSource', position: { x: 0, y: 0 } },
        { id: 'node_dup', type: 'action', position: { x: 100, y: 0 } },
      ],
    };

    const res = await request(app)
      .post('/api/workflows')
      .send(payload)
      .expect(400);

    assert.equal(res.body.success, false);
    const err = res.body.errors.find((e) => e.message.includes('Duplicate node ID'));
    assert.ok(err, 'Expected duplicate node ID rejection');
  });

  it('POST /api/workflows rejects dangling edges that reference non-existent nodes with 400', async () => {
    const payload = {
      name: 'Broken Edge Flow',
      nodes: [
        { id: 'node_valid_1', type: 'dataSource' },
        { id: 'node_valid_2', type: 'math' },
      ],
      edges: [
        { source: 'node_valid_1', target: 'non_existent_target_node' },
      ],
    };

    const res = await request(app)
      .post('/api/workflows')
      .send(payload)
      .expect(400);

    assert.equal(res.body.success, false);
    const err = res.body.errors.find((e) => e.message.includes('Dangling edge'));
    assert.ok(err, 'Expected dangling edge error');
  });

  it('POST /api/workflows rejects self-connecting loop edges with 400', async () => {
    const payload = {
      name: 'Self Loop Flow',
      nodes: [{ id: 'node_loop', type: 'math' }],
      edges: [{ source: 'node_loop', target: 'node_loop' }],
    };

    const res = await request(app)
      .post('/api/workflows')
      .send(payload)
      .expect(400);

    assert.equal(res.body.success, false);
    const err = res.body.errors.find((e) => e.message.includes('self-connecting loop'));
    assert.ok(err, 'Expected self-loop rejection');
  });

  // --------------------------------------------------------------------------
  // 2. GET /api/workflows/:id - Retrieval
  // --------------------------------------------------------------------------
  it('GET /api/workflows/:id retrieves an existing workflow graph by ID', async () => {
    // Seed mock store with a workflow
    const seed = await workflowRepository.createWorkflow({
      id: 'wf_test_123',
      name: 'Seeded Workflow',
      description: 'Used for retrieval test',
      status: 'active',
      nodes: [
        { id: 'n1', type: 'dataSource', position: { x: 10, y: 20 }, config: { sensorId: 'temp-1' } },
        { id: 'n2', type: 'action', position: { x: 300, y: 20 }, config: { action: 'alert' } },
      ],
      edges: [
        { id: 'e1_2', source: 'n1', target: 'n2' },
      ],
    });

    const res = await request(app)
      .get(`/api/workflows/${seed.id}`)
      .expect('Content-Type', /json/)
      .expect(200);

    assert.equal(res.body.success, true);
    assert.equal(res.body.data.id, seed.id);
    assert.equal(res.body.data.name, 'Seeded Workflow');
    assert.equal(res.body.data.nodes.length, 2);
    assert.equal(res.body.data.edges.length, 1);
    assert.deepEqual(res.body.data.nodes[0].position, { x: 10, y: 20 });
  });

  it('GET /api/workflows/:id returns 404 Not Found for non-existent ID', async () => {
    const res = await request(app)
      .get('/api/workflows/non_existent_wf_id')
      .expect('Content-Type', /json/)
      .expect(404);

    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Workflow not found/);
  });

  // --------------------------------------------------------------------------
  // 3. GET /api/workflows - Listing & Filtering
  // --------------------------------------------------------------------------
  it('GET /api/workflows returns list of workflows with count and optional status filter', async () => {
    await workflowRepository.createWorkflow({
      name: 'Active Flow 1',
      status: 'active',
      nodes: [{ id: 'n1', type: 'dataSource' }],
    });
    await workflowRepository.createWorkflow({
      name: 'Draft Flow 2',
      status: 'draft',
      nodes: [{ id: 'n2', type: 'math' }],
    });
    await workflowRepository.createWorkflow({
      name: 'Active Flow 3',
      status: 'active',
      nodes: [{ id: 'n3', type: 'action' }],
    });

    // 1. List all
    const allRes = await request(app)
      .get('/api/workflows')
      .expect(200);

    assert.equal(allRes.body.success, true);
    assert.equal(allRes.body.data.count, 3);
    assert.equal(allRes.body.data.workflows.length, 3);

    // 2. Filter by status=draft
    const draftRes = await request(app)
      .get('/api/workflows?status=draft')
      .expect(200);

    assert.equal(draftRes.body.data.count, 1);
    assert.equal(draftRes.body.data.workflows[0].name, 'Draft Flow 2');
  });

  // --------------------------------------------------------------------------
  // 4. PUT /api/workflows/:id - Update
  // --------------------------------------------------------------------------
  it('PUT /api/workflows/:id updates workflow graph, increments version, and preserves layout', async () => {
    // Create initial workflow
    const initial = await workflowRepository.createWorkflow({
      name: 'Initial Flow',
      description: 'Initial description',
      status: 'draft',
      nodes: [
        { id: 'node_init_1', type: 'dataSource', position: { x: 0, y: 0 } },
      ],
      edges: [],
    });

    assert.equal(initial.version, 1);

    // Update with new nodes and edges
    const updatePayload = {
      name: 'Updated Production Flow',
      description: 'Promoted to production with added threshold and webhook',
      status: 'active',
      nodes: [
        { id: 'node_init_1', type: 'dataSource', position: { x: 50, y: 50 }, config: { sensorId: 'p-1' } },
        { id: 'node_thresh', type: 'threshold', position: { x: 250, y: 50 }, config: { val: 100 } },
        { id: 'node_hook', type: 'webhook', position: { x: 500, y: 50 }, config: { url: 'https://test.io' } },
      ],
      edges: [
        { source: 'node_init_1', target: 'node_thresh' },
        { source: 'node_thresh', target: 'node_hook' },
      ],
    };

    const res = await request(app)
      .put(`/api/workflows/${initial.id}`)
      .send(updatePayload)
      .expect('Content-Type', /json/)
      .expect(200);

    assert.equal(res.body.success, true);
    assert.equal(res.body.data.id, initial.id);
    assert.equal(res.body.data.name, 'Updated Production Flow');
    assert.equal(res.body.data.status, 'active');
    assert.equal(res.body.data.version, 2, 'Expected version to be incremented to 2');
    assert.equal(res.body.data.nodes.length, 3);
    assert.equal(res.body.data.edges.length, 2);

    // Verify updated on retrieval
    const getRes = await request(app).get(`/api/workflows/${initial.id}`).expect(200);
    assert.equal(getRes.body.data.version, 2);
    assert.equal(getRes.body.data.name, 'Updated Production Flow');
  });

  it('PUT /api/workflows/:id returns 404 when attempting to update non-existent workflow', async () => {
    const res = await request(app)
      .put('/api/workflows/fake_wf_id_999')
      .send({
        name: 'New Name',
      })
      .expect(404);

    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Cannot update non-existent workflow/);
  });


  it('PUT /api/workflows/:id rejects nodes-only update that invalidates an existing edge', async () => {
    const initial = await workflowRepository.createWorkflow({
      name: 'Nodes Only Update Test',
      nodes: [
        { id: 'n1', type: 'dataSource' },
        { id: 'n2', type: 'math' },
      ],
      edges: [{ source: 'n1', target: 'n2' }],
    });

    const res = await request(app)
      .put(`/api/workflows/${initial.id}`)
      .send({
        nodes: [{ id: 'n1', type: 'dataSource' }],
      })
      .expect(400);

    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Workflow update validation failed/);
    assert.ok(
      res.body.errors.some((error) =>
        error.message.includes('Dangling edge')
      )
    );
  });

  it('PUT /api/workflows/:id rejects edges-only update referencing a missing node', async () => {
    const initial = await workflowRepository.createWorkflow({
      name: 'Edges Only Update Test',
      nodes: [{ id: 'n1', type: 'dataSource' }],
      edges: [],
    });

    const res = await request(app)
      .put(`/api/workflows/${initial.id}`)
      .send({
        edges: [{ source: 'n1', target: 'missing_node' }],
      })
      .expect(400);

    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Workflow update validation failed/);
    assert.ok(
      res.body.errors.some((error) =>
        error.message.includes('Dangling edge')
      )
    );
  });


  it('PUT /api/workflows/:id rejects invalid updated graph with dangling edge with 400', async () => {
    const initial = await workflowRepository.createWorkflow({
      name: 'Valid Initial',
      nodes: [{ id: 'n1', type: 'math' }],
    });

    const res = await request(app)
      .put(`/api/workflows/${initial.id}`)
      .send({
        nodes: [{ id: 'n1', type: 'math' }],
        edges: [{ source: 'n1', target: 'ghost_node' }],
      })
      .expect(400);

    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Workflow update validation failed/);
  });

  // --------------------------------------------------------------------------
  // 5. DELETE /api/workflows/:id
  // --------------------------------------------------------------------------
  it('DELETE /api/workflows/:id deletes workflow and subsequent GET returns 404', async () => {
    const initial = await workflowRepository.createWorkflow({
      name: 'To Be Deleted',
      nodes: [{ id: 'n1', type: 'dataSource' }],
    });

    const delRes = await request(app)
      .delete(`/api/workflows/${initial.id}`)
      .expect(200);

    assert.equal(delRes.body.success, true);
    assert.equal(delRes.body.data.deleted, true);

    await request(app)
      .get(`/api/workflows/${initial.id}`)
      .expect(404);
  });

  // --------------------------------------------------------------------------
  // 6. Root /api Endpoint Includes Workflow Routes
  // --------------------------------------------------------------------------
  it('GET /api exposes workflow endpoints in service metadata directory', async () => {
    const res = await request(app).get('/api').expect(200);
    assert.ok(res.body.data.endpoints.createWorkflow);
    assert.ok(res.body.data.endpoints.getWorkflowById);
    assert.ok(res.body.data.endpoints.updateWorkflow);
    assert.ok(res.body.data.endpoints.listWorkflows);
  });
});
