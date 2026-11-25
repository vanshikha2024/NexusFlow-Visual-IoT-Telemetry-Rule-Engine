import { Observable } from 'rxjs';

let sinkSequenceCounter = 1;

/**
 * Generic Action Sink Handler Factory (Webhook, Email, MQTT, Sinks)
 *
 * MOCK ONLY: Dispatches simulated actions, records into ExecutionContext,
 * strictly without making real network or messaging calls.
 *
 * @param {Object} node
 * @param {Object} context
 * @param {Object} [options={}]
 * @returns {Function} RxJS Operator: (source$: Observable) => Observable
 */
export const createGenericSink = (node, context, options = {}) => {
  const nodeType = node?.type || 'action';

  return (source$) =>
    new Observable((subscriber) => {
      const subscription = source$.subscribe({
        next(event) {
          try {
            const numericVal =
              typeof event === 'object' && event !== null ? event.value : event;
            const dispatchId = `mock_${nodeType}_${node?.id || 'sink'}_${Date.now()}_${sinkSequenceCounter++}`;

            const actionPayload = {
              dispatchId,
              nodeId: node?.id || 'action_sink',
              nodeType,
              config: node?.config || {},
              telemetry: event,
              sampleValue: numericVal,
              timestamp: new Date().toISOString(),
              isMock: true,
              status: 'DISPATCHED_MOCK',
            };

            context?.recordAlert?.(actionPayload);
            context?.recordEmission?.(node?.id, actionPayload);
            subscriber.next(actionPayload);
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
