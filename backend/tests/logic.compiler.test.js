import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  NexusFlowLogicCompiler,
  compileWorkflow,
  executeWorkflow,
  resetAlertCounter,
} from '../src/compiler/index.js';
import { DISCONNECTED_NODE_STRATEGY } from '../src/graph/constants.js';

describe('Day 9: NexusFlow Logic Compiler End-to-End Tests', () => {
  const compiler = new NexusFlowLogicCompiler();

  // --------------------------------------------------------------------------
  // 1. Core Day 9 Pipeline Requirement:
  //    Sequence [70, 75, 78, 82, 85, 90], Window 3, Threshold > 80 -> SMS Alert
  // --------------------------------------------------------------------------
  describe('Primary Day 9 Telemetry Sequence Verification', () => {
    const primaryWorkflow = {
      id: 'wf_core_telemetry',
      name: 'Temperature Alert Pipeline',
      nodes: [
        {
          id: 'temp_source',
          type: 'temperatureSensor',
          config: { sensorId: 'turbine_temp_01' },
        },
        {
          id: 'moving_avg',
          type: 'movingAverage',
          config: { windowSize: 3, partialWindow: false },
        },
        {
          id: 'threshold_check',
          type: 'threshold',
          config: { operator: '>', threshold: 80.0 },
        },
        {
          id: 'sms_sink',
          type: 'smsAlert',
          config: {
            recipient: '+15550199',
            message: 'Turbine temperature moving average breached 80°C threshold!',
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'temp_source', target: 'moving_avg' },
        { id: 'e2', source: 'moving_avg', target: 'threshold_check' },
        { id: 'e3', source: 'threshold_check', target: 'sms_sink' },
      ],
    };

    it('compiles and executes telemetry sequence [70, 75, 78, 82, 85, 90] with window 3 and threshold > 80', () => {
      resetAlertCounter();
      const sequence = [70, 75, 78, 82, 85, 90];

      const result = compiler.execute(primaryWorkflow, { sequence });

      assert.equal(result.success, true);
      assert.equal(result.summary.totalSamplesFed, 6);
      assert.equal(result.summary.pipelinesRun, 1);
      assert.equal(result.summary.hasErrors, false);

      // Verify exact number of dispatched mock alerts
      assert.equal(result.alerts.length, 2);

      // Sample 1 (70): window [70] -> incomplete -> no alert
      // Sample 2 (75): window [70, 75] -> incomplete -> no alert
      // Sample 3 (78): window [70, 75, 78] -> avg = 74.3333 <= 80 -> no alert
      // Sample 4 (82): window [75, 78, 82] -> avg = 78.3333 <= 80 -> no alert
      // Sample 5 (85): window [78, 82, 85] -> avg = 81.6667 > 80 -> ALERT 1!
      // Sample 6 (90): window [82, 85, 90] -> avg = 85.6667 > 80 -> ALERT 2!

      const alert1 = result.alerts[0];
      assert.equal(alert1.recipient, '+15550199');
      assert.equal(alert1.isMock, true);
      assert.equal(alert1.status, 'DISPATCHED_MOCK');
      assert.ok(Math.abs(alert1.movingAverage - 81.6667) < 0.001);
      assert.ok(Math.abs(alert1.sampleValue - 81.6667) < 0.001);
      assert.equal(alert1.telemetry.originalValue, 85);
      assert.deepEqual(alert1.telemetry.window, [78, 82, 85]);

      const alert2 = result.alerts[1];
      assert.equal(alert2.recipient, '+15550199');
      assert.equal(alert2.isMock, true);
      assert.equal(alert2.status, 'DISPATCHED_MOCK');
      assert.ok(Math.abs(alert2.movingAverage - 85.6667) < 0.001);
      assert.ok(Math.abs(alert2.sampleValue - 85.6667) < 0.001);
      assert.equal(alert2.telemetry.originalValue, 90);
      assert.deepEqual(alert2.telemetry.window, [82, 85, 90]);

      // Verify node emission counts across pipeline
      const emissions = result.emissions;
      assert.equal(emissions.temp_source.length, 6);
      assert.equal(emissions.moving_avg.length, 4); // 4 full windows (samples 3, 4, 5, 6)
      assert.equal(emissions.threshold_check.length, 2); // 2 samples exceeded 80
      assert.equal(emissions.sms_sink.length, 2);
    });

    it('works with convenience helpers compileWorkflow and executeWorkflow', () => {
      resetAlertCounter();
      const result = executeWorkflow(primaryWorkflow, {
        sequence: [70, 75, 78, 82, 85, 90],
      });

      assert.equal(result.success, true);
      assert.equal(result.alerts.length, 2);
      assert.ok(result.alerts[0].movingAverage > 80);
      assert.ok(result.alerts[1].movingAverage > 80);
    });

    it('allows incremental feeding into ExecutionContext directly', () => {
      resetAlertCounter();
      const compiled = compileWorkflow(primaryWorkflow);
      assert.equal(compiled.success, true);

      const ctx = compiled.context;
      assert.equal(ctx.getAlerts().length, 0);

      // Feed first 4 samples
      ctx.feed('turbine_temp_01', 70);
      ctx.feed('turbine_temp_01', 75);
      ctx.feed('turbine_temp_01', 78);
      ctx.feed('turbine_temp_01', 82);
      assert.equal(ctx.getAlerts().length, 0);

      // Feed 5th sample (avg becomes 81.67 > 80)
      ctx.feed('turbine_temp_01', 85);
      assert.equal(ctx.getAlerts().length, 1);
      assert.ok(Math.abs(ctx.getAlerts()[0].movingAverage - 81.6667) < 0.001);

      // Feed 6th sample (avg becomes 85.67 > 80)
      ctx.feed('turbine_temp_01', 90);
      assert.equal(ctx.getAlerts().length, 2);

      compiled.dispose();
    });
  });

  // --------------------------------------------------------------------------
  // 2. Branching & Fan-out / Fan-in Pipelines
  // --------------------------------------------------------------------------
  describe('Branching & Complex DAG Pipelines', () => {
    it('executes fan-out pipeline where 1 source feeds multiple parallel transform and sink branches', () => {
      resetAlertCounter();
      const branchingWorkflow = {
        name: 'Fan-Out Telemetry Pipeline',
        nodes: [
          {
            id: 'src',
            type: 'temperatureSensor',
            config: { sensorId: 'boiler-42' },
          },
          // Branch A: Direct Threshold > 85 -> SMS
          {
            id: 'thresh_direct',
            type: 'threshold',
            config: { operator: '>', threshold: 85 },
          },
          {
            id: 'sms_sink',
            type: 'smsAlert',
            config: { recipient: '+15551111' },
          },
          // Branch B: Moving Average 2 -> Threshold > 80 -> Webhook
          {
            id: 'avg_branch',
            type: 'movingAverage',
            config: { windowSize: 2, partialWindow: false },
          },
          {
            id: 'thresh_avg',
            type: 'threshold',
            config: { operator: '>', threshold: 80 },
          },
          {
            id: 'webhook_sink',
            type: 'webhook',
            config: { url: 'https://example.com/alerts' },
          },
        ],
        edges: [
          { id: 'e1', source: 'src', target: 'thresh_direct' },
          { id: 'e2', source: 'thresh_direct', target: 'sms_sink' },
          { id: 'e3', source: 'src', target: 'avg_branch' },
          { id: 'e4', source: 'avg_branch', target: 'thresh_avg' },
          { id: 'e5', source: 'thresh_avg', target: 'webhook_sink' },
        ],
      };

      // Feed sequence: [70, 85, 90]
      // Branch A: Direct threshold > 85:
      //   - 70 (no)
      //   - 85 (no, 85 is not > 85)
      //   - 90 (yes, > 85) -> 1 SMS alert
      // Branch B: Moving Average 2:
      //   - 70 (incomplete)
      //   - 85 -> avg(70,85)=77.5 <= 80 (no)
      //   - 90 -> avg(85,90)=87.5 > 80 (yes) -> 1 Webhook alert
      const result = compiler.execute(branchingWorkflow, { sequence: [70, 85, 90] });

      assert.equal(result.success, true);
      assert.equal(result.summary.pipelinesRun, 2);
      assert.equal(result.alerts.length, 2);

      const smsAlerts = result.alerts.filter((a) => a.nodeType === 'smsAlert');
      const webhookAlerts = result.alerts.filter((a) => a.nodeType === 'webhook');

      assert.equal(smsAlerts.length, 1);
      assert.equal(smsAlerts[0].sampleValue, 90);

      assert.equal(webhookAlerts.length, 1);
      assert.equal(webhookAlerts[0].sampleValue, 87.5);
    });

    it('executes math scale and unit conversion pipeline', () => {
      resetAlertCounter();
      const mathWorkflow = {
        name: 'Celsius to Fahrenheit and Threshold',
        nodes: [
          { id: 'src', type: 'temperatureSensor', config: { sensorId: 'temp_c' } },
          { id: 'convert', type: 'transform', config: { operation: 'celsiusToFahrenheit' } },
          { id: 'thresh', type: 'threshold', config: { operator: '>=', threshold: 212 } },
          { id: 'sms', type: 'smsAlert', config: { recipient: '+15553333' } },
        ],
        edges: [
          { id: 'e1', source: 'src', target: 'convert' },
          { id: 'e2', source: 'convert', target: 'thresh' },
          { id: 'e3', source: 'thresh', target: 'sms' },
        ],
      };

      // 100°C -> 212°F (>= 212 -> triggers SMS)
      // 50°C -> 122°F (< 212 -> does not trigger)
      const result = compiler.execute(mathWorkflow, { sequence: [50, 100] });

      assert.equal(result.success, true);
      assert.equal(result.alerts.length, 1);
      assert.equal(result.alerts[0].sampleValue, 212);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Validation, Cycle Detection & Error Handling Integration
  // --------------------------------------------------------------------------
  describe('Graph Parser, Validator & Error Handling Integration', () => {
    it('rejects cyclic workflow graph with DEPENDENCY_CYCLE_DETECTED error', () => {
      const cyclicWorkflow = {
        name: 'Cyclic Graph',
        nodes: [
          { id: 'n1', type: 'temperatureSensor', config: { sensorId: 's1' } },
          { id: 'n2', type: 'movingAverage', config: { windowSize: 3 } },
          { id: 'n3', type: 'threshold', config: { operator: '>', threshold: 80 } },
        ],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2' },
          { id: 'e2', source: 'n2', target: 'n3' },
          { id: 'e3', source: 'n3', target: 'n2' }, // Cycle: n2 -> n3 -> n2
        ],
      };

      const result = compiler.compile(cyclicWorkflow);
      assert.equal(result.success, false);
      assert.ok(result.errors.length > 0);
      assert.ok(result.errors.some((e) => e.code === 'CYCLE_DETECTED' || e.code === 'DEPENDENCY_CYCLE_DETECTED'));
    });

    it('rejects workflow with missing required node configuration', () => {
      const invalidConfigWorkflow = {
        name: 'Missing Config',
        nodes: [
          { id: 'src', type: 'temperatureSensor', config: {} }, // missing sensorId
          { id: 'thresh', type: 'threshold', config: { operator: '>' } }, // missing threshold
          { id: 'sink', type: 'smsAlert', config: {} }, // missing recipient
        ],
        edges: [
          { id: 'e1', source: 'src', target: 'thresh' },
          { id: 'e2', source: 'thresh', target: 'sink' },
        ],
      };

      const result = compiler.compile(invalidConfigWorkflow);
      assert.equal(result.success, false);
      assert.ok(result.errors.some((e) => e.code === 'INVALID_NODE_CONFIG'));
    });

    it('handles disconnected nodes according to strategy (PRUNE vs REJECT)', () => {
      const graphWithDisconnected = {
        name: 'Disconnected Nodes',
        nodes: [
          { id: 'src', type: 'temperatureSensor', config: { sensorId: 'temp1' } },
          { id: 'thresh', type: 'threshold', config: { operator: '>', threshold: 50 } },
          { id: 'sink', type: 'smsAlert', config: { recipient: '+1555' } },
          { id: 'isolated_node', type: 'movingAverage', config: { windowSize: 3 } },
        ],
        edges: [
          { id: 'e1', source: 'src', target: 'thresh' },
          { id: 'e2', source: 'thresh', target: 'sink' },
        ],
      };

      // Default strategy PRUNE: compiles successfully and prunes isolated_node
      const prunedResult = compiler.compile(graphWithDisconnected, {
        strategy: DISCONNECTED_NODE_STRATEGY.PRUNE,
      });
      assert.equal(prunedResult.success, true);
      assert.equal(prunedResult.plan.prunedNodes.length, 1);
      assert.equal(prunedResult.plan.prunedNodes[0].id, 'isolated_node');

      // REJECT strategy: rejects with error
      const rejectResult = compiler.compile(graphWithDisconnected, {
        strategy: DISCONNECTED_NODE_STRATEGY.REJECT,
      });
      assert.equal(rejectResult.success, false);
      assert.ok(rejectResult.errors.some((e) => e.code === 'DISCONNECTED_NODES_REJECTED'));
    });

    it('handles runtime non-numeric telemetry values safely without throwing unhandled exceptions', () => {
      const workflow = {
        name: 'Resilience Test',
        nodes: [
          { id: 'src', type: 'temperatureSensor', config: { sensorId: 'resilient_sensor' } },
          { id: 'avg', type: 'movingAverage', config: { windowSize: 2 } },
          { id: 'thresh', type: 'threshold', config: { operator: '>', threshold: 50 } },
          { id: 'sink', type: 'smsAlert', config: { recipient: '+1555' } },
        ],
        edges: [
          { id: 'e1', source: 'src', target: 'avg' },
          { id: 'e2', source: 'avg', target: 'thresh' },
          { id: 'e3', source: 'thresh', target: 'sink' },
        ],
      };

      const result = compiler.execute(workflow, {
        sequence: [40, 'corrupted_sample', 70],
      });

      assert.equal(result.success, true);
      // Moving avg of [40, 70] is 55 > 50 -> 1 alert!
      assert.equal(result.alerts.length, 1);
      assert.equal(result.alerts[0].sampleValue, 55);
    });

    it('disposes cleanly and prevents further feedings into context', () => {
      const workflow = {
        name: 'Disposal Test',
        nodes: [
          { id: 'src', type: 'temperatureSensor', config: { sensorId: 's1' } },
          { id: 'sink', type: 'smsAlert', config: { recipient: '+1555' } },
        ],
        edges: [{ id: 'e1', source: 'src', target: 'sink' }],
      };

      const compiled = compiler.compile(workflow);
      assert.equal(compiled.success, true);

      compiled.dispose();
      assert.throws(() => compiled.context.feed('s1', 100), /disposed/i);
    });
  });
});

