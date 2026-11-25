import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Subject, of, from } from 'rxjs';
import {
  createDataSourceObservable,
  normalizeTelemetry,
  createMovingAverageOperator,
  createThresholdOperator,
  evaluateComparison,
  createSmsAlertSink,
  resetAlertCounter,
  createMathOperator,
  evaluateMathOperation,
  createGenericSink,
} from '../src/compiler/handlers/index.js';
import { ExecutionContext } from '../src/compiler/executionContext.js';

describe('Day 9: RxJS Compiler Handlers Unit Tests', () => {
  let context;

  beforeEach(() => {
    context = new ExecutionContext();
    resetAlertCounter();
  });

  // --------------------------------------------------------------------------
  // 1. Data Source Handler & Telemetry Normalizer
  // --------------------------------------------------------------------------
  describe('Data Source Handler & Normalizer', () => {
    it('normalizes primitive numeric values into telemetry events', () => {
      const event = normalizeTelemetry(75.5, 'turbine-1');
      assert.equal(event.sensorId, 'turbine-1');
      assert.equal(event.value, 75.5);
      assert.ok(event.timestamp);
    });

    it('normalizes telemetry objects and preserves metadata', () => {
      const raw = {
        sensorId: 'sensor-99',
        value: '82.4',
        unit: '┬░C',
        metadata: { room: 'Server Room B' },
      };
      const event = normalizeTelemetry(raw);
      assert.equal(event.sensorId, 'sensor-99');
      assert.equal(event.value, 82.4);
      assert.equal(event.unit, '┬░C');
      assert.equal(event.metadata.room, 'Server Room B');
    });

    it('throws error for invalid null/undefined or non-numeric telemetry', () => {
      assert.throws(() => normalizeTelemetry(null), /cannot be null/i);
      assert.throws(() => normalizeTelemetry({ value: 'invalid_num' }), /non-numeric/i);
      assert.throws(() => normalizeTelemetry('raw-string'), /unsupported/i);
    });

    it('emits static sequence when configured with staticSequence option', () => {
      const node = { id: 'src_1', type: 'temperatureSensor', config: { sensorId: 'temp-1' } };
      const sequence = [70, 75, 78];
      const source$ = createDataSourceObservable(node, context, {
        staticSequence: true,
        sequence,
      });

      const emitted = [];
      source$.subscribe((val) => emitted.push(val));

      assert.equal(emitted.length, 3);
      assert.equal(emitted[0].value, 70);
      assert.equal(emitted[1].value, 75);
      assert.equal(emitted[2].value, 78);
      assert.equal(context.getEmissions('src_1').length, 3);
    });

    it('emits dynamic events fed through ExecutionContext Subject and filters by sensorId', () => {
      const node = { id: 'src_2', type: 'temperatureSensor', config: { sensorId: 'temp-A' } };
      const source$ = createDataSourceObservable(node, context);

      const received = [];
      source$.subscribe((val) => received.push(val));

      context.feed('temp-A', 88);
      context.feed('temp-A', 92);
      // Different sensor should not emit on this source stream
      context.feed('temp-B', 100);

      assert.equal(received.length, 2);
      assert.equal(received[0].value, 88);
      assert.equal(received[1].value, 92);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Moving Average Handler (Sliding Window)
  // --------------------------------------------------------------------------
  describe('Moving Average Handler (Sliding Window)', () => {
    it('calculates sliding window average with windowSize 3 and partialWindow false', () => {
      const node = {
        id: 'avg_node',
        type: 'movingAverage',
        config: { windowSize: 3, partialWindow: false },
      };
      const op = createMovingAverageOperator(node, context);
      const samples = [70, 75, 78, 82, 85, 90];
      const emitted = [];

      from(samples.map((v) => ({ sensorId: 'sensor-1', value: v })))
        .pipe(op)
        .subscribe((e) => emitted.push(e));

      // Window 3 requires 3 samples before first emission:
      // Sample 1 (70): incomplete (no emit)
      // Sample 2 (75): incomplete (no emit)
      // Sample 3 (78): [70, 75, 78] -> avg = 74.33333333333333
      // Sample 4 (82): [75, 78, 82] -> avg = 78.33333333333333
      // Sample 5 (85): [78, 82, 85] -> avg = 81.66666666666667
      // Sample 6 (90): [82, 85, 90] -> avg = 85.66666666666667
      assert.equal(emitted.length, 4);

      assert.ok(Math.abs(emitted[0].value - 74.3333) < 0.001);
      assert.deepEqual(emitted[0].window, [70, 75, 78]);
      assert.equal(emitted[0].originalValue, 78);

      assert.ok(Math.abs(emitted[1].value - 78.3333) < 0.001);
      assert.deepEqual(emitted[1].window, [75, 78, 82]);

      assert.ok(Math.abs(emitted[2].value - 81.6667) < 0.001);
      assert.deepEqual(emitted[2].window, [78, 82, 85]);

      assert.ok(Math.abs(emitted[3].value - 85.6667) < 0.001);
      assert.deepEqual(emitted[3].window, [82, 85, 90]);
      assert.equal(emitted[3].originalValue, 90);

      // Verify context emissions
      assert.equal(context.getEmissions('avg_node').length, 4);
    });

    it('emits from first sample when partialWindow is true', () => {
      const node = {
        id: 'partial_avg',
        type: 'movingAverage',
        config: { windowSize: 3, partialWindow: true },
      };
      const op = createMovingAverageOperator(node, context);
      const samples = [10, 20, 30, 40];
      const emitted = [];

      from(samples.map((v) => ({ value: v })))
        .pipe(op)
        .subscribe((e) => emitted.push(e));

      assert.equal(emitted.length, 4);
      assert.equal(emitted[0].value, 10); // [10] / 1
      assert.equal(emitted[1].value, 15); // [10, 20] / 2
      assert.equal(emitted[2].value, 20); // [10, 20, 30] / 3
      assert.equal(emitted[3].value, 30); // [20, 30, 40] / 3
    });

    it('throws error when windowSize is invalid', () => {
      const invalidNode = {
        id: 'bad_avg',
        type: 'movingAverage',
        config: { windowSize: 0 },
      };
      assert.throws(() => createMovingAverageOperator(invalidNode, context), /invalid windowSize/i);
    });

    it('records error in context and skips non-numeric values without crashing', () => {
      const node = {
        id: 'resilient_avg',
        type: 'movingAverage',
        config: { windowSize: 2, partialWindow: false },
      };
      const op = createMovingAverageOperator(node, context);
      const emitted = [];

      from([{ value: 10 }, { value: 'not-a-number' }, { value: 20 }])
        .pipe(op)
        .subscribe((e) => emitted.push(e));

      // 'not-a-number' was skipped; window became [10, 20] -> avg = 15
      assert.equal(emitted.length, 1);
      assert.equal(emitted[0].value, 15);
      assert.equal(context.getErrors().resilient_avg.length, 1);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Threshold Handler (Operator Condition Filter)
  // --------------------------------------------------------------------------
  describe('Threshold Handler (Zero-eval Comparison)', () => {
    it('evaluates comparison operators safely with evaluateComparison', () => {
      assert.equal(evaluateComparison(85, '>', 80), true);
      assert.equal(evaluateComparison(80, '>', 80), false);
      assert.equal(evaluateComparison(80, '>=', 80), true);
      assert.equal(evaluateComparison(75, '<', 80), true);
      assert.equal(evaluateComparison(80, '<=', 80), true);
      assert.equal(evaluateComparison(80, '==', 80), true);
      assert.equal(evaluateComparison(85, '!=', 80), true);
      assert.equal(evaluateComparison(85, 'gt', 80), true);
      assert.equal(evaluateComparison(75, 'lt', 80), true);
      assert.throws(() => evaluateComparison(85, 'invalid_op', 80), /unsupported/i);
    });

    it('filters telemetry stream matching greater than (>) condition', () => {
      const node = {
        id: 'thresh_1',
        type: 'threshold',
        config: { operator: '>', threshold: 80 },
      };
      const op = createThresholdOperator(node, context);
      const values = [74.33, 78.33, 81.67, 85.67];
      const passed = [];

      from(values.map((v) => ({ sensorId: 'temp', value: v })))
        .pipe(op)
        .subscribe((e) => passed.push(e));

      assert.equal(passed.length, 2);
      assert.equal(passed[0].value, 81.67);
      assert.equal(passed[0].thresholdPassed, true);
      assert.deepEqual(passed[0].matchedCondition, {
        operator: '>',
        threshold: 80,
        actualValue: 81.67,
      });
      assert.equal(passed[1].value, 85.67);
      assert.equal(context.getEmissions('thresh_1').length, 2);
    });

    it('throws error when threshold configuration is missing or non-numeric', () => {
      const missingNode = { id: 'bad_t', type: 'threshold', config: { operator: '>' } };
      assert.throws(() => createThresholdOperator(missingNode), /missing required "threshold"/i);

      const nanNode = { id: 'bad_t2', type: 'threshold', config: { threshold: 'not_num' } };
      assert.throws(() => createThresholdOperator(nanNode), /requires numeric threshold/i);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Mock SMS Alert Sink Handler
  // --------------------------------------------------------------------------
  describe('Mock SMS Alert Output Sink Handler', () => {
    it('captures triggered alerts and records into context without real SMS calls', () => {
      const node = {
        id: 'sms_alert_1',
        type: 'smsAlert',
        config: {
          recipient: '+15550199',
          message: 'Boiler temperature critical!',
        },
      };

      const sinkOp = createSmsAlertSink(node, context);
      const received = [];

      of({
        sensorId: 'boiler-1',
        value: 85.67,
        movingAverage: 85.67,
      })
        .pipe(sinkOp)
        .subscribe((alert) => received.push(alert));

      assert.equal(received.length, 1);
      assert.equal(received[0].isMock, true);
      assert.equal(received[0].status, 'DISPATCHED_MOCK');
      assert.equal(received[0].recipient, '+15550199');
      assert.equal(received[0].sampleValue, 85.67);
      assert.equal(received[0].message, 'Boiler temperature critical!');

      // Context inspection
      const alerts = context.getAlerts();
      assert.equal(alerts.length, 1);
      assert.equal(alerts[0].alertId, received[0].alertId);
    });

    it('generates dynamic alert message when custom message is omitted', () => {
      const node = {
        id: 'sms_alert_auto',
        type: 'smsAlert',
        config: { recipient: '+15559999' },
      };

      const sinkOp = createSmsAlertSink(node, context);

      of({
        sensorId: 'turbine-X',
        value: 81.67,
        movingAverage: 81.67,
      })
        .pipe(sinkOp)
        .subscribe();

      const alerts = context.getAlerts();
      assert.equal(alerts.length, 1);
      assert.ok(alerts[0].message.includes('Sensor turbine-X moving average breached threshold'));
      assert.ok(alerts[0].message.includes('81.67'));
    });
  });

  // --------------------------------------------------------------------------
  // 5. Math & Generic Sinks
  // --------------------------------------------------------------------------
  describe('Math and Action Sinks', () => {
    it('evaluates safe math transformations (scale, offset, celsiusToFahrenheit)', () => {
      assert.equal(evaluateMathOperation(10, 'scale', { factor: 2 }), 20);
      assert.equal(evaluateMathOperation(10, 'offset', { amount: 5 }), 15);
      assert.equal(evaluateMathOperation(100, 'celsiusToFahrenheit'), 212);
      assert.equal(evaluateMathOperation(212, 'fahrenheitToCelsius'), 100);
      assert.equal(evaluateMathOperation(16, 'sqrt'), 4);
      assert.throws(() => evaluateMathOperation(10, 'divide', { divisor: 0 }), /division by zero/i);
    });

    it('creates generic mock sink for webhooks and emails without network requests', () => {
      const node = {
        id: 'webhook_sink',
        type: 'webhook',
        config: { url: 'https://example.com/api/alert' },
      };
      const sinkOp = createGenericSink(node, context);

      of({ sensorId: 'sensor-1', value: 95 })
        .pipe(sinkOp)
        .subscribe();

      assert.equal(context.getAlerts().length, 1);
      assert.equal(context.getAlerts()[0].nodeType, 'webhook');
      assert.equal(context.getAlerts()[0].isMock, true);
    });
  });
});
