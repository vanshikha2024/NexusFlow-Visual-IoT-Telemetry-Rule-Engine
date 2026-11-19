import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GraphValidator,
  validateGraph,
  NodeRegistry,
  ERROR_CODES,
  NODE_CATEGORIES,
} from '../src/graph/index.js';

describe('Day 7: Graph Validator Unit Tests', () => {
  const validator = new GraphValidator();

  // --------------------------------------------------------------------------
  // 1. Valid Workflow Graphs
  // --------------------------------------------------------------------------
  describe('Valid Workflow Graph Scenarios', () => {
    it('validates a standard linear pipeline (Source -> Threshold -> SMS)', () => {
      const graph = {
        nodes: [
          {
            id: 'temp_sensor',
            type: 'temperatureSensor',
            config: { sensorId: 'turbine-sensor-01', metric: 'temperature' },
          },
          {
            id: 'thresh_filter',
            type: 'threshold',
            config: { operator: '>', threshold: 85.0 },
          },
          {
            id: 'sms_alert',
            type: 'smsAlert',
            config: { recipient: '+15550199', message: 'High Temp Alert' },
          },
        ],
        edges: [
          { source: 'temp_sensor', target: 'thresh_filter' },
          { source: 'thresh_filter', target: 'sms_alert' },
        ],
      };

      const result = validator.validate(graph);
      assert.equal(result.isValid, true);
      assert.equal(result.errors.length, 0);
      assert.ok(result.summary);
      assert.equal(result.summary.totalNodes, 3);
      assert.equal(result.summary.totalEdges, 2);
      assert.equal(result.summary.dataSourcesCount, 1);
      assert.equal(result.summary.actionSinksCount, 1);
      assert.equal(result.summary.isAcyclic, true);
      assert.deepEqual(result.summary.topologicalOrder, [
        'temp_sensor',
        'thresh_filter',
        'sms_alert',
      ]);
    });

    it('validates a multi-stage transformation chain (Source -> MovingAvg -> Threshold -> Webhook)', () => {
      const graph = {
        nodes: [
          {
            id: 'vibr_src',
            type: 'vibrationSensor',
            config: { sensorId: 'motor-vibe-42' },
          },
          {
            id: 'm_avg',
            type: 'movingAverage',
            config: { windowSize: 10 },
          },
          {
            id: 'cmp',
            type: 'comparator',
            config: { operator: '>=', threshold: 12.5 },
          },
          {
            id: 'wh',
            type: 'webhook',
            config: { url: 'https://telemetry.corp.net/alert', method: 'POST' },
          },
        ],
        edges: [
          { source: 'vibr_src', target: 'm_avg' },
          { source: 'm_avg', target: 'cmp' },
          { source: 'cmp', target: 'wh' },
        ],
      };

      const result = validateGraph(graph);
      assert.equal(result.isValid, true);
      assert.equal(result.errors.length, 0);
      assert.equal(result.summary.isAcyclic, true);
    });

    it('validates a fan-out graph where 1 source feeds multiple branches', () => {
      const graph = {
        nodes: [
          {
            id: 'press_sensor',
            type: 'pressureSensor',
            config: { sensorId: 'boiler-press-01' },
          },
          {
            id: 'hi_thresh',
            type: 'threshold',
            config: { operator: '>', threshold: 120.0 },
          },
          {
            id: 'lo_thresh',
            type: 'threshold',
            config: { operator: '<', threshold: 20.0 },
          },
          {
            id: 'hi_sms',
            type: 'smsAlert',
            config: { recipient: '+15550111' },
          },
          {
            id: 'lo_sms',
            type: 'smsAlert',
            config: { recipient: '+15550222' },
          },
        ],
        edges: [
          { source: 'press_sensor', target: 'hi_thresh' },
          { source: 'press_sensor', target: 'lo_thresh' },
          { source: 'hi_thresh', target: 'hi_sms' },
          { source: 'lo_thresh', target: 'lo_sms' },
        ],
      };

      const result = validator.validate(graph);
      assert.equal(result.isValid, true);
      assert.equal(result.summary.dataSourcesCount, 1);
      assert.equal(result.summary.actionSinksCount, 2);
    });

    it('validates direct source to action connection without intermediate math', () => {
      const graph = {
        nodes: [
          {
            id: 'src_raw',
            type: 'dataSource',
            config: { sensorId: 'telemetry-stream-raw' },
          },
          {
            id: 'sink_raw',
            type: 'mqttPublish',
            config: { topic: 'iot/raw/stream' },
          },
        ],
        edges: [{ source: 'src_raw', target: 'sink_raw' }],
      };

      const result = validator.validate(graph);
      assert.equal(result.isValid, true);
    });

    it('supports custom node registration with custom validation rules', () => {
      const customRegistry = new NodeRegistry();
      customRegistry.registerNodeType('aiAnomalyDetector', {
        category: NODE_CATEGORIES.MATH_OPERATION,
        label: 'AI Anomaly Detector',
        validateConfig: (config, node) => {
          const errors = [];
          if (!config.modelName) {
            errors.push(`AI node "${node.id}" requires a valid "modelName".`);
          }
          return errors;
        },
      });

      const customValidator = new GraphValidator({ registry: customRegistry });
      const validCustomGraph = {
        nodes: [
          { id: 's1', type: 'dataSource', config: { sensorId: 's-1' } },
          { id: 'ai1', type: 'aiAnomalyDetector', config: { modelName: 'xgboost-v2' } },
          { id: 'a1', type: 'action', config: { channel: 'slack' } },
        ],
        edges: [
          { source: 's1', target: 'ai1' },
          { source: 'ai1', target: 'a1' },
        ],
      };

      const res = customValidator.validate(validCustomGraph);
      assert.equal(res.isValid, true);

      // Verify validation triggers on missing modelName
      const invalidCustomGraph = {
        nodes: [
          { id: 's1', type: 'dataSource', config: { sensorId: 's-1' } },
          { id: 'ai1', type: 'aiAnomalyDetector', config: {} },
          { id: 'a1', type: 'action', config: { channel: 'slack' } },
        ],
        edges: [
          { source: 's1', target: 'ai1' },
          { source: 'ai1', target: 'a1' },
        ],
      };

      const failRes = customValidator.validate(invalidCustomGraph);
      assert.equal(failRes.isValid, false);
      assert.match(failRes.errors[0].message, /requires a valid "modelName"/);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Node Types & Config Validation
  // --------------------------------------------------------------------------
  describe('Node Types & Required Configurations', () => {
    it('detects empty graph with no nodes', () => {
      const result = validator.validate({ nodes: [], edges: [] });
      assert.equal(result.isValid, false);
      assert.equal(result.errors[0].code, ERROR_CODES.EMPTY_GRAPH);
    });

    it('detects duplicate node IDs in graph', () => {
      const graph = {
        nodes: [
          { id: 'node_alpha', type: 'dataSource', config: { sensorId: 's1' } },
          { id: 'node_alpha', type: 'action', config: { recipient: '+1' } },
        ],
        edges: [],
      };

      const result = validator.validate(graph);
      assert.equal(result.isValid, false);
      const err = result.errors.find((e) => e.code === ERROR_CODES.DUPLICATE_NODE_ID);
      assert.ok(err, 'Expected DUPLICATE_NODE_ID error');
      assert.match(err.message, /Duplicate node ID "node_alpha"/);
    });

    it('detects unsupported / unknown node types', () => {
      const graph = {
        nodes: [
          { id: 's1', type: 'alienQuantumProcessor', config: {} },
          { id: 'a1', type: 'smsAlert', config: { recipient: '+1' } },
        ],
        edges: [{ source: 's1', target: 'a1' }],
      };

      const result = validator.validate(graph);
      assert.equal(result.isValid, false);
      const err = result.errors.find((e) => e.code === ERROR_CODES.UNSUPPORTED_NODE_TYPE);
      assert.ok(err, 'Expected UNSUPPORTED_NODE_TYPE error');
      assert.match(err.message, /Unsupported node type "alienQuantumProcessor"/);
    });

    it('detects data source missing required sensorId config', () => {
      const graph = {
        nodes: [
          { id: 'temp_src', type: 'temperatureSensor', config: {} },
          { id: 'act_1', type: 'smsAlert', config: { recipient: '+1555' } },
        ],
        edges: [{ source: 'temp_src', target: 'act_1' }],
      };

      const result = validator.validate(graph);
      assert.equal(result.isValid, false);
      const err = result.errors.find((e) => e.code === ERROR_CODES.INVALID_NODE_CONFIG);
      assert.ok(err, 'Expected INVALID_NODE_CONFIG error');
      assert.match(err.message, /requires a non-empty string "sensorId"/);
    });

    it('detects threshold node missing operator or threshold value', () => {
      const graph = {
        nodes: [
          { id: 's1', type: 'dataSource', config: { sensorId: 's-1' } },
          { id: 'th1', type: 'threshold', config: { operator: 'INVALID_OP' } },
          { id: 'a1', type: 'smsAlert', config: { recipient: '+1' } },
        ],
        edges: [
          { source: 's1', target: 'th1' },
          { source: 'th1', target: 'a1' },
        ],
      };

      const result = validator.validate(graph);
      assert.equal(result.isValid, false);
      const configErrs = result.errors.filter((e) => e.code === ERROR_CODES.INVALID_NODE_CONFIG);
      assert.ok(configErrs.length >= 1);
    });

    it('detects movingAverage node with invalid windowSize (non-positive / non-integer)', () => {
      const graph = {
        nodes: [
          { id: 's1', type: 'dataSource', config: { sensorId: 's-1' } },
          { id: 'm1', type: 'movingAverage', config: { windowSize: -5 } },
          { id: 'a1', type: 'smsAlert', config: { recipient: '+1' } },
        ],
        edges: [
          { source: 's1', target: 'm1' },
          { source: 'm1', target: 'a1' },
        ],
      };

      const result = validator.validate(graph);
      assert.equal(result.isValid, false);
      const err = result.errors.find((e) => e.code === ERROR_CODES.INVALID_NODE_CONFIG);
      assert.ok(err);
      assert.match(err.message, /positive integer "windowSize"/);
    });

    it('detects webhook action node with invalid or malformed URL', () => {
      const graph = {
        nodes: [
          { id: 's1', type: 'dataSource', config: { sensorId: 's-1' } },
          { id: 'wh1', type: 'webhook', config: { url: 'ftp://not-http.org' } },
        ],
        edges: [{ source: 's1', target: 'wh1' }],
      };

      const result = validator.validate(graph);
      assert.equal(result.isValid, false);
      const err = result.errors.find((e) => e.code === ERROR_CODES.INVALID_NODE_CONFIG);
      assert.ok(err);
      assert.match(err.message, /must use http:\/\/ or https:\/\//);
    });

    it('detects SMS alert missing recipient or phone number', () => {
      const graph = {
        nodes: [
          { id: 's1', type: 'dataSource', config: { sensorId: 's-1' } },
          { id: 'sms1', type: 'smsAlert', config: { message: 'Alert only' } },
        ],
        edges: [{ source: 's1', target: 'sms1' }],
      };

      const result = validator.validate(graph);
      assert.equal(result.isValid, false);
      const err = result.errors.find((e) => e.code === ERROR_CODES.INVALID_NODE_CONFIG);
      assert.ok(err);
      assert.match(err.message, /requires a non-empty string "recipient" or "phone"/);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Edge References & Connection Integrity
  // --------------------------------------------------------------------------
  describe('Edge References & Connection Rules', () => {
    it('detects dangling edge referencing non-existent source node', () => {
      const graph = {
        nodes: [
          { id: 'node_b', type: 'action', config: { recipient: '+1555' } },
        ],
        edges: [{ source: 'non_existent_source', target: 'node_b' }],
      };

      const result = validator.validate(graph);
      assert.equal(result.isValid, false);
      const err = result.errors.find((e) => e.code === ERROR_CODES.INVALID_EDGE_REFERENCE);
      assert.ok(err);
      assert.match(err.message, /Dangling edge/);
      assert.match(err.message, /source node "non_existent_source" does not exist/);
    });

    it('detects dangling edge referencing non-existent target node', () => {
      const graph = {
        nodes: [
          { id: 'node_a', type: 'dataSource', config: { sensorId: 's1' } },
        ],
        edges: [{ source: 'node_a', target: 'ghost_target_node' }],
      };

      const result = validator.validate(graph);
      assert.equal(result.isValid, false);
      const err = result.errors.find((e) => e.code === ERROR_CODES.INVALID_EDGE_REFERENCE);
      assert.ok(err);
      assert.match(err.message, /target node "ghost_target_node" does not exist/);
    });

    it('detects self-connecting loops (node connecting directly to itself)', () => {
      const graph = {
        nodes: [
          { id: 'self_loop_node', type: 'math', config: { operator: '>', threshold: 10 } },
        ],
        edges: [{ source: 'self_loop_node', target: 'self_loop_node' }],
      };

      const result = validator.validate(graph);
      assert.equal(result.isValid, false);
      const err = result.errors.find((e) => e.code === ERROR_CODES.SELF_LOOP);
      assert.ok(err);
      assert.match(err.message, /Invalid self-connecting loop/);
    });

    it('warns on duplicate redundant edges between identical source and target', () => {
      const graph = {
        nodes: [
          { id: 's1', type: 'dataSource', config: { sensorId: 's1' } },
          { id: 'a1', type: 'action', config: { recipient: '+1' } },
        ],
        edges: [
          { id: 'e1', source: 's1', target: 'a1' },
          { id: 'e2', source: 's1', target: 'a1' },
        ],
      };

      const result = validator.validate(graph);
      const warn = result.warnings.find((w) => w.code === ERROR_CODES.DUPLICATE_EDGE);
      assert.ok(warn, 'Expected DUPLICATE_EDGE warning');
    });

    it('detects unsupported connection: target is dataSource (source cannot have incoming edges)', () => {
      const graph = {
        nodes: [
          { id: 'math_1', type: 'math', config: { operator: '>', threshold: 10 } },
          { id: 'src_2', type: 'temperatureSensor', config: { sensorId: 's2' } },
          { id: 'act_1', type: 'smsAlert', config: { recipient: '+1' } },
        ],
        edges: [
          { source: 'math_1', target: 'src_2' },
          { source: 'src_2', target: 'act_1' },
        ],
      };

      const result = validator.validate(graph);
      assert.equal(result.isValid, false);
      const err = result.errors.find((e) => e.code === ERROR_CODES.UNSUPPORTED_CONNECTION);
      assert.ok(err);
      assert.match(err.message, /Data source node "src_2".*cannot have incoming edges/);
    });

    it('detects unsupported connection: source is action (action cannot have outgoing edges)', () => {
      const graph = {
        nodes: [
          { id: 'src_1', type: 'dataSource', config: { sensorId: 's1' } },
          { id: 'act_1', type: 'smsAlert', config: { recipient: '+1' } },
          { id: 'math_1', type: 'threshold', config: { operator: '>', threshold: 10 } },
        ],
        edges: [
          { source: 'src_1', target: 'act_1' },
          { source: 'act_1', target: 'math_1' },
        ],
      };

      const result = validator.validate(graph);
      assert.equal(result.isValid, false);
      const err = result.errors.find((e) => e.code === ERROR_CODES.UNSUPPORTED_CONNECTION);
      assert.ok(err);
      assert.match(err.message, /Action trigger node "act_1".*cannot have outgoing edges/);
    });

    it('detects unsupported connection: dataSource connecting directly to another dataSource', () => {
      const graph = {
        nodes: [
          { id: 'src_1', type: 'dataSource', config: { sensorId: 's1' } },
          { id: 'src_2', type: 'temperatureSensor', config: { sensorId: 's2' } },
          { id: 'act_1', type: 'smsAlert', config: { recipient: '+1' } },
        ],
        edges: [
          { source: 'src_1', target: 'src_2' },
          { source: 'src_2', target: 'act_1' },
        ],
      };

      const result = validator.validate(graph);
      assert.equal(result.isValid, false);
      const err = result.errors.find((e) => e.code === ERROR_CODES.UNSUPPORTED_CONNECTION);
      assert.ok(err);
      assert.match(err.message, /Cannot connect data source.*directly to another data source/);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Cycle Detection (Acyclic Graph Requirement)
  // --------------------------------------------------------------------------
  describe('Cycle Detection & DAG Verification', () => {
    it('detects 2-node cycle (A -> B -> A) and returns clear actionable error', () => {
      const graph = {
        nodes: [
          { id: 's1', type: 'dataSource', config: { sensorId: 's-1' } },
          { id: 'm1', type: 'movingAverage', config: { windowSize: 5 } },
          { id: 'm2', type: 'threshold', config: { operator: '>', threshold: 50 } },
          { id: 'a1', type: 'action', config: { recipient: '+1' } },
        ],
        edges: [
          { source: 's1', target: 'm1' },
          { source: 'm1', target: 'm2' },
          { source: 'm2', target: 'm1' }, // Cycle: m1 -> m2 -> m1
          { source: 'm2', target: 'a1' },
        ],
      };

      const result = validator.validate(graph);
      assert.equal(result.isValid, false);
      const cycleErr = result.errors.find((e) => e.code === ERROR_CODES.CYCLE_DETECTED);
      assert.ok(cycleErr, 'Expected CYCLE_DETECTED error');
      assert.match(cycleErr.message, /m1 -> m2 -> m1/);
      assert.match(cycleErr.message, /acyclic execution graph \(DAG\)/);
    });

    it('detects 3-node cycle (X -> Y -> Z -> X) in complex graph', () => {
      const graph = {
        nodes: [
          { id: 'src', type: 'dataSource', config: { sensorId: 's-1' } },
          { id: 'n_x', type: 'math', config: { operator: '>', threshold: 1 } },
          { id: 'n_y', type: 'math', config: { operator: '>', threshold: 2 } },
          { id: 'n_z', type: 'math', config: { operator: '>', threshold: 3 } },
          { id: 'act', type: 'action', config: { recipient: '+1' } },
        ],
        edges: [
          { source: 'src', target: 'n_x' },
          { source: 'n_x', target: 'n_y' },
          { source: 'n_y', target: 'n_z' },
          { source: 'n_z', target: 'n_x' }, // Cycle: n_x -> n_y -> n_z -> n_x
          { source: 'n_z', target: 'act' },
        ],
      };

      const result = validator.validate(graph);
      assert.equal(result.isValid, false);
      const cycleErr = result.errors.find((e) => e.code === ERROR_CODES.CYCLE_DETECTED);
      assert.ok(cycleErr);
      assert.match(cycleErr.message, /n_x -> n_y -> n_z -> n_x/);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Missing Required Source / Sink Nodes
  // --------------------------------------------------------------------------
  describe('Source and Sink Completeness', () => {
    it('detects missing data source node in graph', () => {
      const graph = {
        nodes: [
          { id: 'math_only', type: 'threshold', config: { operator: '>', threshold: 10 } },
          { id: 'act_only', type: 'smsAlert', config: { recipient: '+1555' } },
        ],
        edges: [{ source: 'math_only', target: 'act_only' }],
      };

      const result = validator.validate(graph);
      assert.equal(result.isValid, false);
      const err = result.errors.find((e) => e.code === ERROR_CODES.MISSING_SOURCE_NODE);
      assert.ok(err, 'Expected MISSING_SOURCE_NODE error');
      assert.match(err.message, /must contain at least one data source node/);
    });

    it('detects missing action trigger sink node in graph', () => {
      const graph = {
        nodes: [
          { id: 'src_only', type: 'dataSource', config: { sensorId: 's-1' } },
          { id: 'math_only', type: 'threshold', config: { operator: '>', threshold: 10 } },
        ],
        edges: [{ source: 'src_only', target: 'math_only' }],
      };

      const result = validator.validate(graph);
      assert.equal(result.isValid, false);
      const err = result.errors.find((e) => e.code === ERROR_CODES.MISSING_ACTION_NODE);
      assert.ok(err, 'Expected MISSING_ACTION_NODE error');
      assert.match(err.message, /must contain at least one action trigger node/);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Graph Structure Diagnostics (Orphans, Dead Ends, Unreachable)
  // --------------------------------------------------------------------------
  describe('Graph Structure Diagnostics', () => {
    it('detects disconnected orphan node (isolated on canvas)', () => {
      const graph = {
        nodes: [
          { id: 'src_1', type: 'dataSource', config: { sensorId: 's1' } },
          { id: 'act_1', type: 'smsAlert', config: { recipient: '+1' } },
          { id: 'orphan_filter', type: 'threshold', config: { operator: '>', threshold: 5 } },
        ],
        edges: [{ source: 'src_1', target: 'act_1' }],
      };

      const result = validator.validate(graph);
      assert.equal(result.isValid, false);
      const err = result.errors.find((e) => e.code === ERROR_CODES.DISCONNECTED_NODE);
      assert.ok(err, 'Expected DISCONNECTED_NODE error');
      assert.match(err.message, /Disconnected node "orphan_filter"/);
    });

    it('detects unreachable nodes not connected to any data source', () => {
      const graph = {
        nodes: [
          { id: 'src_main', type: 'dataSource', config: { sensorId: 's1' } },
          { id: 'act_main', type: 'smsAlert', config: { recipient: '+1' } },
          { id: 'island_math', type: 'math', config: { operator: '>', threshold: 5 } },
          { id: 'island_act', type: 'action', config: { recipient: '+2' } },
        ],
        edges: [
          { source: 'src_main', target: 'act_main' },
          { source: 'island_math', target: 'island_act' },
        ],
      };

      const result = validator.validate(graph);
      assert.equal(result.isValid, false);
      const err = result.errors.find((e) => e.code === ERROR_CODES.UNREACHABLE_NODE);
      assert.ok(err, 'Expected UNREACHABLE_NODE error');
      assert.match(err.message, /is unreachable from any data source node/);
    });

    it('detects dead-end intermediate math node with no downstream consumer', () => {
      const graph = {
        nodes: [
          { id: 'src_1', type: 'dataSource', config: { sensorId: 's1' } },
          { id: 'math_dead', type: 'movingAverage', config: { windowSize: 5 } },
          { id: 'act_1', type: 'smsAlert', config: { recipient: '+1' } },
        ],
        edges: [
          { source: 'src_1', target: 'act_1' },
          { source: 'src_1', target: 'math_dead' },
        ],
      };

      const result = validator.validate(graph);
      assert.equal(result.isValid, false);
      const err = result.errors.find((e) => e.code === ERROR_CODES.DEAD_END_NODE);
      assert.ok(err, 'Expected DEAD_END_NODE error');
      assert.match(err.message, /no outgoing connection to a downstream transform or action sink/);
    });
  });

  // --------------------------------------------------------------------------
  // 7. Configurable Options
  // --------------------------------------------------------------------------
  describe('Validator Configurable Options', () => {
    it('allows suppressing orphan checks with allowDisconnectedNodes: true', () => {
      const graph = {
        nodes: [
          { id: 's1', type: 'dataSource', config: { sensorId: 's1' } },
          { id: 'a1', type: 'action', config: { recipient: '+1' } },
          { id: 'draft_node', type: 'math', config: { operator: '>', threshold: 1 } },
        ],
        edges: [{ source: 's1', target: 'a1' }],
      };

      const res = validator.validate(graph, {
        allowDisconnectedNodes: true,
        allowDeadEnds: true,
      });
      assert.equal(res.isValid, true);
    });

    it('allows suppressing sink requirement with requireSinkNode: false', () => {
      const graph = {
        nodes: [
          { id: 's1', type: 'dataSource', config: { sensorId: 's1' } },
          { id: 'm1', type: 'math', config: { operator: '>', threshold: 1 } },
        ],
        edges: [{ source: 's1', target: 'm1' }],
      };

      const res = validator.validate(graph, {
        requireSinkNode: false,
        allowDeadEnds: true,
      });
      assert.equal(res.isValid, true);
    });
  });
});
