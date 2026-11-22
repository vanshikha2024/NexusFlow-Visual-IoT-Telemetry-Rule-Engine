import { Observable } from 'rxjs';

/**
 * Moving Average Sliding Window RxJS Operator Factory
 *
 * Maintains a rolling FIFO window of size W.
 * When partialWindow is false (default):
 *   Only emits once W samples have accumulated.
 * When partialWindow is true:
 *   Emits from the very first sample using available samples in window.
 *
 * Enriches event with:
 * - value: arithmetic average of the window
 * - movingAverage: arithmetic average of the window
 * - window: copy of current numeric buffer
 * - windowSize: configured window size
 * - originalValue: raw sample value before averaging
 *
 * @param {Object} node - Visual workflow node definition
 * @param {Object} [context] - ExecutionContext for metrics/logging
 * @param {Object} [options={}] - Additional runtime overrides
 * @returns {Function} RxJS Operator function: (source$: Observable) => Observable
 */
export const createMovingAverageOperator = (node, context = null, options = {}) => {
  const rawSize = node.config?.windowSize ?? node.data?.windowSize ?? options.windowSize ?? 3;
  const windowSize = Number(rawSize);

  if (isNaN(windowSize) || !Number.isInteger(windowSize) || windowSize < 1) {
    throw new Error(
      `Invalid windowSize "${rawSize}" for movingAverage node "${node?.id || 'unknown'}". Window size must be an integer >= 1.`
    );
  }

  const partialWindow = Boolean(
    node.config?.partialWindow ?? node.data?.partialWindow ?? options.partialWindow ?? false
  );

  return (source$) =>
    new Observable((subscriber) => {
      const windowBuffer = [];

      const subscription = source$.subscribe({
        next(event) {
          try {
            const rawVal =
              typeof event === 'object' && event !== null ? event.value : event;
            const numericVal = typeof rawVal === 'number' ? rawVal : Number(rawVal);

            if (isNaN(numericVal)) {
              const err = new Error(
                `Moving average node "${node?.id}" received non-numeric value: ${JSON.stringify(rawVal)}`
              );
              context?.recordError?.(node?.id, err);
              // Safely skip non-numeric sample rather than crashing pipeline
              return;
            }

            windowBuffer.push(numericVal);
            if (windowBuffer.length > windowSize) {
              windowBuffer.shift();
            }

            // If not partialWindow, require exactly windowSize samples
            if (!partialWindow && windowBuffer.length < windowSize) {
              return;
            }

            const sum = windowBuffer.reduce((acc, curr) => acc + curr, 0);
            const average = sum / windowBuffer.length;

            const enriched =
              typeof event === 'object' && event !== null
                ? {
                    ...event,
                    value: average,
                    movingAverage: average,
                    window: [...windowBuffer],
                    windowSize,
                    sampleCount: windowBuffer.length,
                    originalValue: numericVal,
                  }
                : {
                    value: average,
                    movingAverage: average,
                    window: [...windowBuffer],
                    windowSize,
                    sampleCount: windowBuffer.length,
                    originalValue: numericVal,
                    timestamp: new Date().toISOString(),
                  };

            context?.recordEmission?.(node?.id, enriched);
            subscriber.next(enriched);
          } catch (handlerErr) {
            context?.recordError?.(node?.id, handlerErr);
            subscriber.error(handlerErr);
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
