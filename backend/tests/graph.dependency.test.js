import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GraphDependencyResolver,
  resolveGraphDependencies,
  ExecutionHandlerRegistry,
  DISCONNECTED_NODE_STRATEGY,
  HANDLER_TYPES,
  ERROR_CODES,
  NODE_CATEGORIES,
} from '../src/graph/index.js';

describe('Day 8: Graph Dependency Resolver Unit Tests', () => {
  const resolver = new GraphDependencyResolver();

  // --------------------------------------------------------------------------
  // 1. Linear Graph Dependency Resolution
  // --------------------------------------------------------------------------
  describe('Linear Pipeline Graphs (Source -> Math -> Action)', () => {
    it('resolves dependencies for a 3-node linear pipeline and orders execution topologically', () => {
      const graph = {
        name: 'Linear Pipeline',
        nodes: [
          {
            id: 'temp_src',
            type: 'temperatureSensor',
            config: { sensorId: 'turbine-01', metric: 'temperature' },
          },
          {
            id: 'thresh_filter',
            type: 'threshold',
            config: { operator: '>', threshold: 85.0 },
          },
          {
            id: 'sms_sink',
            type: 'smsAlert',
            config: { recipient: '+15550199', message: 'High Temp Alert' },
          },
        ],
        edges: [
          { id: 'e1', source: 'temp_src', target: 'thresh_filter' },
          { id: 'e2', source: 'thresh_filter', target: 'sms_sink' },
        ],
      };

      const result = resolver.resolve(graph);
      assert.equal(result.success, true);
      assert.equal(result.errors.length, 0);

      const plan = result.plan;
      assert.ok(plan);
      assert.deepEqual(plan.topologicalOrder, ['temp_src', 'thresh_filter', 'sms_sink']);

      // Verify stages
      assert.equal(plan.executionStages.length, 3);
      assert.deepEqual(plan.executionStages[0].nodeIds, ['temp_src']);
      assert.deepEqual(plan.executionStages[1].nodeIds, ['thresh_filter']);
      assert.deepEqual(plan.executionStages[2].nodeIds, ['sms_sink']);

      // Verify node dependency resolution
      const srcNode = plan.nodesById.get('temp_src');
      assert.equal(srcNode.isSource, true);
      assert.equal(srcNode.executionStage, 0);
      assert.equal(srcNode.upstream.length, 0);
      assert.equal(srcNode.downstream.length, 1);
      assert.equal(srcNode.downstream[0].targetId, 'thresh_filter');
      assert.equal(srcNode.handler.handlerId, 'temperatureSensorHandler');
      assert.equal(srcNode.handler.handlerType, HANDLER_TYPES.SOURCE);

      const filterNode = plan.nodesById.get('thresh_filter');
      assert.equal(filterNode.isIntermediate, true);
      assert.equal(filterNode.executionStage, 1);
      assert.equal(filterNode.upstream.length, 1);
      assert.equal(filterNode.upstream[0].sourceId, 'temp_src');
      assert.equal(filterNode.downstream.length, 1);
      assert.equal(filterNode.downstream[0].targetId, 'sms_sink');
      assert.equal(filterNode.handler.handlerId, 'thresholdFilterHandler');
      assert.equal(filterNode.handler.rxPattern, 'filter');

      const sinkNode = plan.nodesById.get('sms_sink');
      assert.equal(sinkNode.isSink, true);
      assert.equal(sinkNode.executionStage, 2);
      assert.equal(sinkNode.upstream.length, 1);
      assert.equal(sinkNode.upstream[0].sourceId, 'thresh_filter');
      assert.equal(sinkNode.downstream.length, 0);
      assert.equal(sinkNode.handler.handlerId, 'smsAlertHandler');
      assert.equal(sinkNode.handler.handlerType, HANDLER_TYPES.SINK);

      // Verify pipeline tracing
      assert.equal(plan.pipelines.length, 1);
      assert.equal(plan.pipelines[0].sourceId, 'temp_src');
      assert.equal(plan.pipelines[0].sinkId, 'sms_sink');
      assert.deepEqual(plan.pipelines[0].path, ['temp_src', 'thresh_filter', 'sms_sink']);
    });

    it('resolves multi-step linear chain (Source -> Avg -> Thresh -> Action)', () => {
      const graph = {
        nodes: [
          { id: 's1', type: 'vibrationSensor', config: { sensorId: 'vib-01' } },
          { id: 'm1', type: 'movingAverage', config: { windowSize: 10 } },
          { id: 'm2', type: 'threshold', config: { operator: '>=', threshold: 5.0 } },
          { id: 'a1', type: 'webhook', config: { url: 'https://example.com/api' } },
        ],
        edges: [
          { source: 's1', target: 'm1' },
          { source: 'm1', target: 'm2' },
          { source: 'm2', target: 'a1' },
        ],
      };

      const { plan } = resolveGraphDependencies(graph);
      assert.deepEqual(plan.topologicalOrder, ['s1', 'm1', 'm2', 'a1']);
      assert.equal(plan.executionStages.length, 4);
      assert.equal(plan.pipelines[0].path.length, 4);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Branching Graphs (Fan-out, Fan-in, Diamond DAG)
  // --------------------------------------------------------------------------
  describe('Branching Graph Scenarios', () => {
    it('resolves fan-out dependencies where 1 source feeds multiple parallel branches', () => {
      // s1 -> [m1 -> a1, m2 -> a2]
      const graph = {
        nodes: [
          { id: 'src', type: 'pressureSensor', config: { sensorId: 'press-01' } },
          { id: 'hi_filter', type: 'threshold', config: { operator: '>', threshold: 100 } },
          { id: 'lo_filter', type: 'threshold', config: { operator: '<', threshold: 10 } },
          { id: 'hi_sms', type: 'smsAlert', config: { recipient: '+15551111' } },
          { id: 'lo_email', type: 'emailNotification', config: { recipient: 'alert@corp.org' } },
        ],
        edges: [
          { source: 'src', target: 'hi_filter' },
          { source: 'src', target: 'lo_filter' },
          { source: 'hi_filter', target: 'hi_sms' },
          { source: 'lo_filter', target: 'lo_email' },
        ],
      };

      const result = resolver.resolve(graph);
      assert.equal(result.success, true);
      const plan = result.plan;

      // Both hi_filter and lo_filter should share executionStage 1 (parallel execution)
      assert.equal(plan.nodesById.get('hi_filter').executionStage, 1);
      assert.equal(plan.nodesById.get('lo_filter').executionStage, 1);

      // Both sinks share executionStage 2
      assert.equal(plan.nodesById.get('hi_sms').executionStage, 2);
      assert.equal(plan.nodesById.get('lo_email').executionStage, 2);

      // Verify two distinct end-to-end pipelines traced
      assert.equal(plan.pipelines.length, 2);
      const paths = plan.pipelines.map((p) => p.path);
      assert.ok(paths.some((p) => p.join('->') === 'src->hi_filter->hi_sms'));
      assert.ok(paths.some((p) => p.join('->') === 'src->lo_filter->lo_email'));
    });

    it('resolves fan-in graph where multiple independent sources feed downstream transforms', () => {
      // [s1, s2] -> m1 -> a1
      const graph = {
        nodes: [
          { id: 's1', type: 'temperatureSensor', config: { sensorId: 'temp-1' } },
          { id: 's2', type: 'humiditySensor', config: { sensorId: 'hum-1' } },
          { id: 'm1', type: 'transform', config: { operation: 'scale' } },
          { id: 'a1', type: 'webhook', config: { url: 'https://iot.net' } },
        ],
        edges: [
          { source: 's1', target: 'm1' },
          { source: 's2', target: 'm1' },
          { source: 'm1', target: 'a1' },
        ],
      };

      const result = resolver.resolve(graph);
      assert.equal(result.success, true);
      const plan = result.plan;

      const m1 = plan.nodesById.get('m1');
      assert.equal(m1.upstream.length, 2);
      const upstreamSources = m1.upstream.map((u) => u.sourceId).sort();
      assert.deepEqual(upstreamSources, ['s1', 's2']);

      // 2 source-to-sink pipelines
      assert.equal(plan.pipelines.length, 2);
    });

    it('resolves Diamond DAG (Source -> [BranchA, BranchB] -> Merge -> Sink)', () => {
      // s1 -> [mA, mB] -> mMerge -> a1
      const graph = {
        nodes: [
          { id: 'src_root', type: 'dataSource', config: { sensorId: 'root-01' } },
          { id: 'branch_a', type: 'movingAverage', config: { windowSize: 5 } },
          { id: 'branch_b', type: 'threshold', config: { operator: '>', threshold: 10 } },
          { id: 'merge_op', type: 'transform', config: { operation: 'add' } },
          { id: 'sink_end', type: 'mqttPublish', config: { topic: 'alerts/diamond' } },
        ],
        edges: [
          { source: 'src_root', target: 'branch_a' },
          { source: 'src_root', target: 'branch_b' },
          { source: 'branch_a', target: 'merge_op' },
          { source: 'branch_b', target: 'merge_op' },
          { source: 'merge_op', target: 'sink_end' },
        ],
      };

      const result = resolver.resolve(graph);
      assert.equal(result.success, true);
      const plan = result.plan;

      assert.equal(plan.nodesById.get('src_root').executionStage, 0);
      assert.equal(plan.nodesById.get('branch_a').executionStage, 1);
      assert.equal(plan.nodesById.get('branch_b').executionStage, 1);
      assert.equal(plan.nodesById.get('merge_op').executionStage, 2);
      assert.equal(plan.nodesById.get('sink_end').executionStage, 3);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Dependency Cycles & Invalid Dependencies
  // --------------------------------------------------------------------------
  describe('Dependency Cycle & Invalid Dependency Detection', () => {
    it('detects direct 2-node cycle (A -> B -> A) and returns DEPENDENCY_CYCLE_DETECTED', () => {
      const graph = {
        nodes: [
          { id: 's1', type: 'dataSource', config: { sensorId: 's1' } },
          { id: 'm1', type: 'movingAverage', config: { windowSize: 5 } },
          { id: 'm2', type: 'threshold', config: { operator: '>', threshold: 50 } },
          { id: 'a1', type: 'action', config: { recipient: '+1' } },
        ],
        edges: [
          { source: 's1', target: 'm1' },
          { source: 'm1', target: 'm2' },
          { source: 'm2', target: 'm1' }, // Cycle
          { source: 'm2', target: 'a1' },
        ],
      };

      const result = resolver.resolve(graph);
      assert.equal(result.success, false);
      assert.equal(result.plan, null);
      const cycleErr = result.errors.find((e) =>
        [ERROR_CODES.CYCLE_DETECTED, ERROR_CODES.DEPENDENCY_CYCLE_DETECTED].includes(e.code)
      );
      assert.ok(cycleErr, 'Expected cycle detection error');
      assert.match(cycleErr.message, /m1 -> m2 -> m1/);
    });

    it('detects 3-node cycle (X -> Y -> Z -> X) and halts execution planning', () => {
      const graph = {
        nodes: [
          { id: 'src', type: 'dataSource', config: { sensorId: 's1' } },
          { id: 'n1', type: 'math', config: { operator: '>', threshold: 1 } },
          { id: 'n2', type: 'math', config: { operator: '>', threshold: 2 } },
          { id: 'n3', type: 'math', config: { operator: '>', threshold: 3 } },
          { id: 'act', type: 'action', config: { recipient: '+1' } },
        ],
        edges: [
          { source: 'src', target: 'n1' },
          { source: 'n1', target: 'n2' },
          { source: 'n2', target: 'n3' },
          { source: 'n3', target: 'n1' }, // Cycle: n1 -> n2 -> n3 -> n1
          { source: 'n3', target: 'act' },
        ],
      };

      const result = resolver.resolve(graph);
      assert.equal(result.success, false);
      const err = result.errors[0];
      assert.match(err.message, /n1 -> n2 -> n3 -> n1/);
    });

    it('returns error when dangling edge source or target is referenced', () => {
      const graph = {
        nodes: [
          { id: 's1', type: 'dataSource', config: { sensorId: 's1' } },
          { id: 'a1', type: 'action', config: { recipient: '+1' } },
        ],
        edges: [
          { source: 's1', target: 'ghost_missing_node' },
        ],
      };

      const result = resolver.resolve(graph);
      assert.equal(result.success, false);
      assert.ok(result.errors.some((e) => e.code === ERROR_CODES.INVALID_EDGE_REFERENCE));
    });
  });

  // --------------------------------------------------------------------------
  // 4. Disconnected Node Strategies (PRUNE vs REJECT vs WARN)
  // --------------------------------------------------------------------------
  describe('Disconnected & Unreachable Node Handling Strategies', () => {
    const disconnectedGraph = {
      nodes: [
        { id: 's1', type: 'dataSource', config: { sensorId: 's1' } },
        { id: 'a1', type: 'smsAlert', config: { recipient: '+1555' } },
        { id: 'orphan_note', type: 'math', config: { operator: '>', threshold: 10 } },
        { id: 'island_math', type: 'math', config: { operator: '<', threshold: 5 } },
        { id: 'island_act', type: 'action', config: { recipient: '+2' } },
      ],
      edges: [
        { source: 's1', target: 'a1' },
        { source: 'island_math', target: 'island_act' }, // unreachable from s1
      ],
    };

    it('prunes isolated and unreachable nodes by default (PRUNE strategy)', () => {
      const result = resolver.resolve(disconnectedGraph, {
        strategy: DISCONNECTED_NODE_STRATEGY.PRUNE,
      });

      assert.equal(result.success, true);
      const plan = result.plan;
      assert.deepEqual(plan.topologicalOrder, ['s1', 'a1']);
      assert.equal(plan.prunedNodes.length, 3);

      const prunedIds = plan.prunedNodes.map((n) => n.id).sort();
      assert.deepEqual(prunedIds, ['island_act', 'island_math', 'orphan_note']);
      assert.equal(plan.metadata.activeNodesCount, 2);
      assert.equal(plan.metadata.prunedNodesCount, 3);
    });

    it('rejects graph with error when strategy is set to REJECT', () => {
      const result = resolver.resolve(disconnectedGraph, {
        strategy: DISCONNECTED_NODE_STRATEGY.REJECT,
      });

      assert.equal(result.success, false);
      assert.equal(result.plan, null);
      assert.ok(result.errors.length >= 1);
    });

    it('prunes nodes and emits diagnostic warnings when strategy is WARN', () => {
      const result = resolver.resolve(disconnectedGraph, {
        strategy: DISCONNECTED_NODE_STRATEGY.WARN,
      });

      assert.equal(result.success, true);
      assert.ok(result.warnings.length >= 1);
      assert.deepEqual(result.plan.topologicalOrder, ['s1', 'a1']);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Execution Handler Mapping & Registry
  // --------------------------------------------------------------------------
  describe('Execution Handler Mapping & Registry Extensibility', () => {
    it('maps all standard node types to corresponding Day 9 backend execution handlers', () => {
      const testTypes = [
        { type: 'temperatureSensor', expectedHandler: 'temperatureSensorHandler', expectedType: 'source' },
        { type: 'humiditySensor', expectedHandler: 'humiditySensorHandler', expectedType: 'source' },
        { type: 'threshold', expectedHandler: 'thresholdFilterHandler', expectedType: 'operator' },
        { type: 'movingAverage', expectedHandler: 'movingAverageHandler', expectedType: 'operator' },
        { type: 'transform', expectedHandler: 'dataTransformHandler', expectedType: 'operator' },
        { type: 'smsAlert', expectedHandler: 'smsAlertHandler', expectedType: 'sink' },
        { type: 'webhook', expectedHandler: 'webhookDispatchHandler', expectedType: 'sink' },
        { type: 'mqttPublish', expectedHandler: 'mqttPublishHandler', expectedType: 'sink' },
      ];

      const registry = new ExecutionHandlerRegistry();
      for (const item of testTypes) {
        const handler = registry.getHandler(item.type);
        assert.ok(handler, `Expected handler for ${item.type}`);
        assert.equal(handler.handlerId, item.expectedHandler);
        assert.equal(handler.handlerType, item.expectedType);
      }
    });

    it('supports custom execution handler registration and injection into resolver', () => {
      const customRegistry = new ExecutionHandlerRegistry();
      customRegistry.registerHandler('customGrpcEmitter', {
        handlerId: 'grpcEmitterHandler',
        handlerName: 'gRPC Alert Sink',
        category: NODE_CATEGORIES.ACTION_TRIGGER,
        handlerType: HANDLER_TYPES.SINK,
        description: 'Dispatches gRPC event to control service',
        rxPattern: 'tap',
        inputs: 1,
        outputs: 0,
      });

      // NodeRegistry to also allow custom node type
      const customNodeRegistry = new ExecutionHandlerRegistry();
      const customResolver = new GraphDependencyResolver({
        handlerRegistry: customRegistry,
      });

      const graph = {
        nodes: [
          { id: 'src_1', type: 'dataSource', config: { sensorId: 'sensor-1' } },
          { id: 'grpc_1', type: 'customGrpcEmitter', config: { endpoint: 'localhost:50051' } },
        ],
        edges: [{ source: 'src_1', target: 'grpc_1' }],
      };

      const result = customResolver.resolve(graph, { validateFirst: false });
      assert.equal(result.success, true);
      const grpcNode = result.plan.nodesById.get('grpc_1');
      assert.equal(grpcNode.handler.handlerId, 'grpcEmitterHandler');
      assert.equal(grpcNode.handler.handlerType, HANDLER_TYPES.SINK);
    });

    it('reports MISSING_HANDLER error when active node has no registered execution handler', () => {
      const emptyRegistry = new ExecutionHandlerRegistry({});
      const customResolver = new GraphDependencyResolver({
        handlerRegistry: emptyRegistry,
      });

      const graph = {
        nodes: [
          { id: 's1', type: 'dataSource', config: { sensorId: 's1' } },
          { id: 'a1', type: 'action', config: { recipient: '+1' } },
        ],
        edges: [{ source: 's1', target: 'a1' }],
      };

      const result = customResolver.resolve(graph, { validateFirst: false });
      assert.equal(result.success, false);
      const err = result.errors.find((e) => e.code === ERROR_CODES.MISSING_HANDLER);
      assert.ok(err, 'Expected MISSING_HANDLER error');
      assert.match(err.message, /No backend execution handler found/);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Day 9 Preparation: Structured Execution Plan
  // --------------------------------------------------------------------------
  describe('Day 9 RxJS Compiler Preparation', () => {
    it('generates complete execution plan metadata ready for RxJS stream compilation', () => {
      const graph = {
        nodes: [
          { id: 'sensor_1', type: 'dataSource', config: { sensorId: 's-1' } },
          { id: 'math_1', type: 'movingAverage', config: { windowSize: 5 } },
          { id: 'math_2', type: 'threshold', config: { operator: '>', threshold: 10 } },
          { id: 'action_1', type: 'smsAlert', config: { recipient: '+1' } },
        ],
        edges: [
          { source: 'sensor_1', target: 'math_1' },
          { source: 'math_1', target: 'math_2' },
          { source: 'math_2', target: 'action_1' },
        ],
      };

      const result = resolver.resolve(graph);
      assert.equal(result.success, true);
      const plan = result.plan;

      assert.ok(plan.sources.length === 1);
      assert.ok(plan.sinks.length === 1);
      assert.ok(plan.topologicalOrder.length === 4);
      assert.ok(plan.executionStages.length === 4);
      assert.equal(plan.metadata.isAcyclic, true);
      assert.equal(plan.metadata.pipelineCount, 1);
    });
  });
});
