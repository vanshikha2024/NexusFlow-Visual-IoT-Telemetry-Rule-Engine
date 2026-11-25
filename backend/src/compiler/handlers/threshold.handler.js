import { Observable } from 'rxjs';

/**
 * Pure evaluation of comparison operator against threshold.
 * Strictly zero eval() or arbitrary code execution.
 *
 * @param {number} val
 * @param {string} op
 * @param {number} threshold
 * @returns {boolean}
 */
export const evaluateComparison = (val, op, threshold) => {
  const normalizedOp = String(op).trim().toLowerCase();

  switch (normalizedOp) {
    case '>':
    case 'gt':
      return val > threshold;
    case '<':
    case 'lt':
      return val < threshold;
    case '>=':
    case 'gte':
      return val >= threshold;
    case '<=':
    case 'lte':
      return val <= threshold;
    case '==':
    case '===':
    case 'eq':
      return val === threshold;
    case '!=':
    case '!==':
    case 'neq':
      return val !== threshold;
    default:
      throw new Error(`Unsupported comparison operator: "${op}"`);
  }
};

/**
 * Threshold Filter RxJS Operator Factory
 *
 * Filters incoming telemetry stream, emitting only events where the condition evaluates to true.
 * Attaches condition evaluation metadata to passing events.
 *
 * @param {Object} node - Visual workflow node definition
 * @param {Object} [context] - ExecutionContext
 * @param {Object} [options={}] - Runtime overrides
 * @returns {Function} RxJS Operator: (source$: Observable) => Observable
 */
export const createThresholdOperator = (node, context = null, options = {}) => {
  const operator = String(
    node.config?.operator ?? node.data?.operator ?? options.operator ?? '>'
  ).trim();

  const rawThreshold =
    node.config?.threshold ?? node.data?.threshold ?? options.threshold;

  if (rawThreshold === undefined || rawThreshold === null) {
    throw new Error(
      `Threshold node "${node?.id || 'unknown'}" is missing required "threshold" configuration.`
    );
  }

  const threshold = Number(rawThreshold);
  if (isNaN(threshold)) {
    throw new Error(
      `Threshold node "${node?.id}" requires numeric threshold value. Received: ${rawThreshold}`
    );
  }

  // Pre-validate operator
  evaluateComparison(0, operator, 0);

  return (source$) =>
    new Observable((subscriber) => {
      const subscription = source$.subscribe({
        next(event) {
          try {
            const rawVal =
              typeof event === 'object' && event !== null ? event.value : event;
            const numericVal = typeof rawVal === 'number' ? rawVal : Number(rawVal);

            if (isNaN(numericVal)) {
              const err = new Error(
                `Threshold node "${node?.id}" cannot compare non-numeric value: ${JSON.stringify(rawVal)}`
              );
              context?.recordError?.(node?.id, err);
              return;
            }

            const satisfies = evaluateComparison(numericVal, operator, threshold);

            if (satisfies) {
              const enriched =
                typeof event === 'object' && event !== null
                  ? {
                      ...event,
                      thresholdPassed: true,
                      matchedCondition: {
                        operator,
                        threshold,
                        actualValue: numericVal,
                      },
                    }
                  : {
                      value: numericVal,
                      thresholdPassed: true,
                      matchedCondition: {
                        operator,
                        threshold,
                        actualValue: numericVal,
                      },
                      timestamp: new Date().toISOString(),
                    };

              context?.recordEmission?.(node?.id, enriched);
              subscriber.next(enriched);
            }
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
