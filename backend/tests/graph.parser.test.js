import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GraphParser,
  parseGraph,
  NODE_CATEGORIES,
  ERROR_CODES,
} from '../src/graph/index.js';

describe('Day 7: Graph Parser Unit Tests', () => {
  const parser = new GraphParser();

  // --------------------------------------------------------------------------
  // 1. JSON Parsing & Deserialization (Safe, No eval)
  // --------------------------------------------------------------------------
  describe('Safe JSON Deserialization & Payload Normalization', () => {
    it('successfully parses raw JSON string into graph AST', () => {
      const jsonStr = JSON.stringify({
        nodes: [
          {
            id: 'sensor_1',
            type: 'dataSource',
            position: { x: 50, y: 100 },
            config: { sensorId: 'temp-sensor-01' },
          },
          {
            id: 'thresh_1',
            type: 'threshold',
            position: { x: 250, y: 100 },
            config: { operator: '>', threshold: 75.0 },
          },
          {
            id: 'sms_1',
            type: 'smsAlert',
            position: { x: 450, y: 100 },
            config: { recipient: '+15550199' },
          },
        ],
        edges: [
          { id: 'e1', source: 'sensor_1', target: 'thresh_1' },
          { id: 'e2', source: 'thresh_1', target: 'sms_1' },
        ],
      });

      const result = parser.parse(jsonStr);
      assert.equal(result.success, true);
      assert.equal(result.errors.length, 0);
      assert.ok(result.graph);
      assert.equal(result.graph.nodes.length, 3);
      assert.equal(result.graph.edges.length, 2);
    });

    it('successfully parses standard JavaScript object payload', () => {
      const payload = {
        nodes: [
          { id: 's1', type: 'temperatureSensor', config: { sensorId: 's-01' } },
          { id: 'a1', type: 'webhook', config: { url: 'https://example.com/api' } },
        ],
        edges: [{ source: 's1', target: 'a1' }],
      };

      const result = parseGraph(payload);
      assert.equal(result.success, true);
      assert.equal(result.graph.nodes.length, 2);
      assert.equal(result.graph.edges.length, 1);
    });

    it('extracts nested workflow object when wrapped in { workflow: { nodes, edges } }', () => {
      const wrapped = {
        workflow: {
          name: 'Nested Flow',
          nodes: [{ id: 'n1', type: 'dataSource', config: { sensorId: 'sensor-99' } }],
          edges: [],
        },
      };

      const result = parser.parse(wrapped);
      assert.equal(result.success, true);
      assert.equal(result.graph.nodes.length, 1);
      assert.equal(result.graph.nodes[0].id, 'n1');
    });

    it('parses React Flow canvas export with viewport without crashing', () => {
      const rfExport = {
        nodes: [{ id: 'src_1', type: 'dataSource', position: { x: 10, y: 20 } }],
        edges: [],
        viewport: { x: 100, y: 200, zoom: 1.5 },
      };

      const result = parser.parse(rfExport);
      assert.equal(result.success, true);
      assert.equal(result.graph.nodes[0].position.x, 10);
      assert.equal(result.graph.nodes[0].position.y, 20);
    });

    it('rejects malformed JSON string with actionable syntax error', () => {
      const malformed = '{"nodes": [{"id": "incomplete...';
      const result = parser.parse(malformed);
      assert.equal(result.success, false);
      assert.equal(result.graph, null);
      assert.equal(result.errors.length, 1);
      assert.equal(result.errors[0].code, ERROR_CODES.INVALID_JSON);
      assert.match(result.errors[0].message, /Failed to parse workflow JSON/);
    });

    it('rejects null, non-object, and array root payloads', () => {
      const nullResult = parser.parse(null);
      assert.equal(nullResult.success, false);
      assert.equal(nullResult.errors[0].code, ERROR_CODES.INVALID_STRUCTURE);

      const arrayResult = parser.parse([1, 2, 3]);
      assert.equal(arrayResult.success, false);
      assert.equal(arrayResult.errors[0].code, ERROR_CODES.INVALID_STRUCTURE);

      const numResult = parser.parse(12345);
      assert.equal(numResult.success, false);
      assert.equal(numResult.errors[0].code, ERROR_CODES.INVALID_STRUCTURE);
    });

    it('rejects missing or non-array nodes property', () => {
      const res = parser.parse({ edges: [] });
      assert.equal(res.success, false);
      assert.equal(res.errors[0].field, 'nodes');
      assert.equal(res.errors[0].code, ERROR_CODES.INVALID_STRUCTURE);
    });

    it('does NOT execute arbitrary JavaScript strings (safe evaluation guarantee)', () => {
      const dangerousJson = JSON.stringify({
        nodes: [
          {
            id: 'exploit_node',
            type: 'expression',
            config: {
              formula: 'process.exit(1);',
              expression: '(() => { throw new Error("pwned"); })()',
            },
          },
        ],
        edges: [],
      });

      // Parsing must NOT evaluate code or throw unexpected process errors
      const result = parser.parse(dangerousJson);
      assert.equal(result.success, true);
      assert.equal(result.graph.nodes[0].id, 'exploit_node');
      assert.equal(result.graph.nodes[0].config.formula, 'process.exit(1);');
    });
  });

  // --------------------------------------------------------------------------
  // 2. Node Normalization & Category Resolution
  // --------------------------------------------------------------------------
  describe('Node Normalization & Category Resolution', () => {
    it('normalizes node categories correctly based on node definitions', () => {
      const payload = {
        nodes: [
          { id: 'src_temp', type: 'temperatureSensor' },
          { id: 'src_press', type: 'pressureSensor' },
          { id: 'math_avg', type: 'movingAverage' },
          { id: 'math_thresh', type: 'threshold' },
          { id: 'act_sms', type: 'smsAlert' },
          { id: 'act_hook', type: 'webhook' },
        ],
        edges: [],
      };

      const { graph } = parser.parse(payload);
      assert.equal(graph.nodesById.get('src_temp').category, NODE_CATEGORIES.DATA_SOURCE);
      assert.equal(graph.nodesById.get('src_press').category, NODE_CATEGORIES.DATA_SOURCE);
      assert.equal(graph.nodesById.get('math_avg').category, NODE_CATEGORIES.MATH_OPERATION);
      assert.equal(graph.nodesById.get('math_thresh').category, NODE_CATEGORIES.MATH_OPERATION);
      assert.equal(graph.nodesById.get('act_sms').category, NODE_CATEGORIES.ACTION_TRIGGER);
      assert.equal(graph.nodesById.get('act_hook').category, NODE_CATEGORIES.ACTION_TRIGGER);
    });

    it('smoothly extracts configuration from node.config, node.data.config, and node.data', () => {
      const payload = {
        nodes: [
          {
            id: 'n1',
            type: 'dataSource',
            config: { sensorId: 'sensor-top-config' },
          },
          {
            id: 'n2',
            type: 'threshold',
            data: { config: { operator: '>', threshold: 100 } },
          },
          {
            id: 'n3',
            type: 'smsAlert',
            data: { recipient: '+15559999', message: 'Hello' },
          },
        ],
        edges: [],
      };

      const { graph } = parser.parse(payload);
      assert.equal(graph.nodesById.get('n1').config.sensorId, 'sensor-top-config');
      assert.equal(graph.nodesById.get('n2').config.operator, '>');
      assert.equal(graph.nodesById.get('n2').config.threshold, 100);
      assert.equal(graph.nodesById.get('n3').config.recipient, '+15559999');
    });

    it('identifies and reports duplicate node IDs', () => {
      const payload = {
        nodes: [
          { id: 'node_dup', type: 'dataSource' },
          { id: 'node_unique', type: 'math' },
          { id: 'node_dup', type: 'action' },
        ],
        edges: [],
      };

      const result = parser.parse(payload);
      assert.equal(result.success, false);
      const dupErr = result.errors.find((e) => e.code === ERROR_CODES.DUPLICATE_NODE_ID);
      assert.ok(dupErr, 'Expected duplicate node ID error');
      assert.equal(dupErr.details.duplicateId, 'node_dup');
    });

    it('flags nodes missing non-empty string ID', () => {
      const payload = {
        nodes: [
          { id: '', type: 'dataSource' },
          { id: '   ', type: 'math' },
        ],
        edges: [],
      };

      const result = parser.parse(payload);
      assert.equal(result.success, false);
      assert.equal(result.errors.length, 2);
      assert.equal(result.errors[0].code, ERROR_CODES.INVALID_NODE_ID);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Adjacency Graph, In/Out Degrees, & Topology Analysis
  // --------------------------------------------------------------------------
  describe('Adjacency Graph & Degree Calculations', () => {
    it('correctly builds adjacency and degree maps for a multi-branch pipeline', () => {
      const payload = {
        nodes: [
          { id: 'src_1', type: 'dataSource' },
          { id: 'math_1', type: 'movingAverage' },
          { id: 'math_2', type: 'threshold' },
          { id: 'act_1', type: 'smsAlert' },
          { id: 'act_2', type: 'webhook' },
        ],
        edges: [
          { id: 'e1', source: 'src_1', target: 'math_1' },
          { id: 'e2', source: 'src_1', target: 'math_2' },
          { id: 'e3', source: 'math_1', target: 'act_1' },
          { id: 'e4', source: 'math_2', target: 'act_2' },
        ],
      };

      const { graph } = parser.parse(payload);
      assert.deepEqual(graph.adjacency.get('src_1'), ['math_1', 'math_2']);
      assert.deepEqual(graph.adjacency.get('math_1'), ['act_1']);
      assert.deepEqual(graph.adjacency.get('math_2'), ['act_2']);
      assert.deepEqual(graph.adjacency.get('act_1'), []);

      assert.equal(graph.inDegree.get('src_1'), 0);
      assert.equal(graph.outDegree.get('src_1'), 2);
      assert.equal(graph.inDegree.get('math_1'), 1);
      assert.equal(graph.outDegree.get('math_1'), 1);
      assert.equal(graph.inDegree.get('act_1'), 1);
      assert.equal(graph.outDegree.get('act_1'), 0);
    });

    it('generates fallback edge IDs if omitted by frontend', () => {
      const payload = {
        nodes: [
          { id: 'src', type: 'dataSource' },
          { id: 'act', type: 'action' },
        ],
        edges: [{ source: 'src', target: 'act' }],
      };

      const { graph } = parser.parse(payload);
      assert.ok(graph.edges[0].id.startsWith('edge_src_act_'));
    });
  });

  // --------------------------------------------------------------------------
  // 4. Cycle Detection & Topological Sorting (DAG Engine)
  // --------------------------------------------------------------------------
  describe('Cycle Detection & Topological Sorting', () => {
    it('computes exact topological sort order for linear pipeline', () => {
      const payload = {
        nodes: [
          { id: 'sms_node', type: 'smsAlert' },
          { id: 'temp_node', type: 'temperatureSensor' },
          { id: 'filter_node', type: 'movingAverage' },
        ],
        edges: [
          { source: 'temp_node', target: 'filter_node' },
          { source: 'filter_node', target: 'sms_node' },
        ],
      };

      const { graph } = parser.parse(payload);
      assert.equal(graph.isAcyclic, true);
      assert.equal(graph.cycles.length, 0);
      assert.deepEqual(graph.topologicalOrder, ['temp_node', 'filter_node', 'sms_node']);
    });

    it('detects a direct 2-node cycle (A -> B -> A) and returns exact cycle path', () => {
      const payload = {
        nodes: [
          { id: 'node_a', type: 'math' },
          { id: 'node_b', type: 'math' },
        ],
        edges: [
          { source: 'node_a', target: 'node_b' },
          { source: 'node_b', target: 'node_a' },
        ],
      };

      const { graph } = parser.parse(payload);
      assert.equal(graph.isAcyclic, false);
      assert.ok(graph.cycles.length > 0);
      assert.deepEqual(graph.cycles[0], ['node_a', 'node_b', 'node_a']);
      assert.equal(graph.topologicalOrder, null);
    });

    it('detects a 3-node cycle (A -> B -> C -> A) and extracts cycle path slice', () => {
      const payload = {
        nodes: [
          { id: 'step_1', type: 'math' },
          { id: 'step_2', type: 'math' },
          { id: 'step_3', type: 'math' },
        ],
        edges: [
          { source: 'step_1', target: 'step_2' },
          { source: 'step_2', target: 'step_3' },
          { source: 'step_3', target: 'step_1' },
        ],
      };

      const { graph } = parser.parse(payload);
      assert.equal(graph.isAcyclic, false);
      assert.ok(graph.cycles.length >= 1);
      assert.deepEqual(graph.cycles[0], ['step_1', 'step_2', 'step_3', 'step_1']);
      assert.equal(graph.topologicalOrder, null);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Reachability, Orphans, & Dead-End Analysis
  // --------------------------------------------------------------------------
  describe('Reachability & Structural Diagnostics', () => {
    it('identifies disconnected orphan nodes (inDegree 0 and outDegree 0)', () => {
      const payload = {
        nodes: [
          { id: 'src_1', type: 'dataSource' },
          { id: 'act_1', type: 'action' },
          { id: 'orphan_node', type: 'math' },
        ],
        edges: [{ source: 'src_1', target: 'act_1' }],
      };

      const { graph } = parser.parse(payload);
      assert.equal(graph.reachability.orphanNodes.length, 1);
      assert.equal(graph.reachability.orphanNodes[0].id, 'orphan_node');
    });

    it('identifies nodes unreachable from any data source node', () => {
      const payload = {
        nodes: [
          { id: 'src_valid', type: 'dataSource' },
          { id: 'act_valid', type: 'action' },
          { id: 'island_math', type: 'math' },
          { id: 'island_act', type: 'action' },
        ],
        edges: [
          { source: 'src_valid', target: 'act_valid' },
          { source: 'island_math', target: 'island_act' },
        ],
      };

      const { graph } = parser.parse(payload);
      const unreachableIds = graph.reachability.unreachableNodes.map((n) => n.id);
      assert.ok(unreachableIds.includes('island_math'));
      assert.ok(unreachableIds.includes('island_act'));
      assert.ok(!unreachableIds.includes('src_valid'));
      assert.ok(!unreachableIds.includes('act_valid'));
    });

    it('identifies dead-end intermediate math nodes that have in-degree but no downstream consumer', () => {
      const payload = {
        nodes: [
          { id: 'src_1', type: 'dataSource' },
          { id: 'math_dead_end', type: 'math' },
        ],
        edges: [{ source: 'src_1', target: 'math_dead_end' }],
      };

      const { graph } = parser.parse(payload);
      assert.equal(graph.reachability.deadEndNodes.length, 1);
      assert.equal(graph.reachability.deadEndNodes[0].id, 'math_dead_end');
    });
  });
});
