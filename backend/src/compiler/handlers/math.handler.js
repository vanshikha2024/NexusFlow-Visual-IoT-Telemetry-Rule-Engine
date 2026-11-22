import { Observable } from 'rxjs';

/**
 * Pure evaluation of safe mathematical transformations without eval().
 *
 * @param {number} val
 * @param {string} op
 * @param {Object} [params={}]
 * @returns {number}
 */
export const evaluateMathOperation = (val, op, params = {}) => {
  const normalized = String(op || 'scale').toLowerCase();

  switch (normalized) {
    case 'scale':
    case 'multiply': {
      const factor = Number(params.factor ?? params.scale ?? params.value ?? 1);
      return val * factor;
    }
    case 'offset':
    case 'add': {
      const amount = Number(params.amount ?? params.offset ?? params.value ?? 0);
      return val + amount;
    }
    case 'subtract': {
      const amount = Number(params.amount ?? params.offset ?? params.value ?? 0);
      return val - amount;
    }
    case 'divide': {
      const divisor = Number(params.divisor ?? params.value ?? 1);
      if (divisor === 0) throw new Error('Division by zero in math operation.');
      return val / divisor;
    }
    case 'abs':
      return Math.abs(val);
    case 'round':
      return Math.round(val);
    case 'floor':
      return Math.floor(val);
    case 'ceil':
      return Math.ceil(val);
    case 'sqrt': {
      if (val < 0) throw new Error('Cannot calculate square root of negative number.');
      return Math.sqrt(val);
    }
    case 'celsiustofahrenheit':
      return (val * 9) / 5 + 32;
    case 'fahrenheittocelsius':
      return ((val - 32) * 5) / 9;
    default:
      return val;
  }
};

/**
 * Math & Transform Operator Factory
 *
 * @param {Object} node - Visual workflow node definition
 * @param {Object} [context] - ExecutionContext
 * @param {Object} [options={}] - Runtime overrides
 * @returns {Function} RxJS Operator: (source$: Observable) => Observable
 */
export const createMathOperator = (node, context = null, options = {}) => {
  const operation =
    node.config?.operation ||
    node.data?.operation ||
    node.config?.mathOp ||
    options.operation ||
    'scale';

  const params = {
    ...node.data,
    ...node.config,
    ...options,
  };

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
                `Math node "${node?.id}" cannot transform non-numeric value: ${JSON.stringify(rawVal)}`
              );
              context?.recordError?.(node?.id, err);
              return;
            }

            const transformed = evaluateMathOperation(numericVal, operation, params);

            const enriched =
              typeof event === 'object' && event !== null
                ? {
                    ...event,
                    value: transformed,
                    originalValue: numericVal,
                    mathOperation: operation,
                  }
                : {
                    value: transformed,
                    originalValue: numericVal,
                    mathOperation: operation,
                    timestamp: new Date().toISOString(),
                  };

            context?.recordEmission?.(node?.id, enriched);
            subscriber.next(enriched);
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
