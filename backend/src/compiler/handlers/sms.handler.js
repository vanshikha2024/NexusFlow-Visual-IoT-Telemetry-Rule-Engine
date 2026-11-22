import { Observable } from 'rxjs';

let alertSequenceCounter = 1;

/**
 * Reset mock alert sequence counter (useful for unit tests)
 */
export const resetAlertCounter = () => {
  alertSequenceCounter = 1;
};

/**
 * Mock SMS Alert Output Sink Handler Factory
 *
 * Captures triggered alert events, formats emergency notification payload,
 * and records it into ExecutionContext.dispatchedAlerts without making real network calls.
 *
 * STRICT REQUIREMENT: No real SMS messages are dispatched.
 *
 * @param {Object} node - Visual workflow node definition
 * @param {Object} context - ExecutionContext instance
 * @param {Object} [options={}]
 * @returns {Function} RxJS Operator: (source$: Observable) => Observable
 */
export const createSmsAlertSink = (node, context, options = {}) => {
  const recipient =
    node.config?.recipient || node.data?.recipient || options.recipient || '+1000000000';
  const customMessage =
    node.config?.message || node.data?.message || options.message || null;

  return (source$) =>
    new Observable((subscriber) => {
      const subscription = source$.subscribe({
        next(event) {
          try {
            const alertId = `mock_sms_${node?.id || 'alert'}_${Date.now()}_${alertSequenceCounter++}`;
            const numericVal =
              typeof event === 'object' && event !== null ? event.value : event;
            const movingAvg =
              typeof event === 'object' && event !== null ? event.movingAverage : undefined;
            const sensorId =
              typeof event === 'object' && event !== null ? event.sensorId : 'unknown-sensor';

            const defaultMessage =
              movingAvg !== undefined
                ? `[ALERT] Sensor ${sensorId} moving average breached threshold: ${Number(movingAvg).toFixed(2)}`
                : `[ALERT] Sensor ${sensorId} triggered alert condition with value: ${numericVal}`;

            const alertPayload = {
              alertId,
              nodeId: node?.id || 'sms_sink',
              nodeType: node?.type || 'smsAlert',
              recipient,
              message: customMessage || defaultMessage,
              timestamp: new Date().toISOString(),
              sampleValue: numericVal,
              movingAverage: movingAvg !== undefined ? movingAvg : null,
              telemetry: event,
              isMock: true,
              status: 'DISPATCHED_MOCK',
            };

            // Record into ExecutionContext
            context?.recordAlert?.(alertPayload);
            context?.recordEmission?.(node?.id, alertPayload);

            // Pass through in case downstream nodes or subscribers observe
            subscriber.next(alertPayload);
          } catch (err) {
            context?.recordError?.(node?.id, err);
            subscriber.error(err);
          }
        },
        error(err) {
          context?.recordError?.(node?.id, err);
          subscriber.error(err);
        },
        complete() {
          subscriber.complete();
        },
      });

      return () => {
        subscription.unsubscribe();
      };
    });
};
