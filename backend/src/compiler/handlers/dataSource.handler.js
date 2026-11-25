import { from } from 'rxjs';
import { map, filter, tap } from 'rxjs/operators';

/**
 * Normalizes incoming raw telemetry event into standard NexusFlow telemetry format.
 *
 * @param {number|Object} sample
 * @param {string} [defaultSensorId='default-sensor']
 * @returns {Object}
 */
export const normalizeTelemetry = (sample, defaultSensorId = 'default-sensor') => {
  if (sample === null || sample === undefined) {
    throw new Error('Telemetry sample cannot be null or undefined.');
  }

  if (typeof sample === 'number') {
    return {
      sensorId: defaultSensorId,
      value: sample,
      timestamp: new Date().toISOString(),
    };
  }

  if (typeof sample === 'object') {
    const sensorId = sample.sensorId || sample.id || defaultSensorId;
    const value = typeof sample.value === 'number' ? sample.value : Number(sample.value);

    if (isNaN(value)) {
      throw new Error(`Telemetry sample contains non-numeric value: ${JSON.stringify(sample)}`);
    }

    return {
      sensorId,
      value,
      unit: sample.unit || '',
      sensorType: sample.sensorType || 'sensor',
      timestamp: sample.timestamp || new Date().toISOString(),
      metadata: sample.metadata || {},
    };
  }

  throw new Error(`Unsupported telemetry format: ${typeof sample}`);
};

/**
 * Data Source Handler Factory (RxJS Observable Source)
 *
 * Emits telemetry events matching node.config.sensorId from either:
 * - A predefined static sample sequence (e.g. [70, 75, 78, 82, 85, 90])
 * - An interactive Subject for runtime event feeding via ExecutionContext
 *
 * Catches invalid/corrupted samples safely, records diagnostic errors into context,
 * and maintains continuous stream execution.
 *
 * @param {Object} node - Workflow node definition
 * @param {Object} context - Execution context
 * @param {Object} [options={}]
 * @param {Array<number|Object>} [options.sequence] - Predefined sample sequence
 * @param {boolean} [options.staticSequence] - Force static sequence Observable (using RxJS from)
 * @returns {import('rxjs').Observable}
 */
export const createDataSourceObservable = (node, context, options = {}) => {
  const sensorId = node.config?.sensorId || node.data?.sensorId || node.id || 'default-sensor';
  const staticSequence =
    options.staticSequence === true
      ? options.sequence || node.config?.sequence || null
      : Array.isArray(node.config?.sequence)
      ? node.config.sequence
      : null;

  if (Array.isArray(staticSequence) && staticSequence.length > 0) {
    const normalizedSequence = [];
    for (const s of staticSequence) {
      try {
        normalizedSequence.push(normalizeTelemetry(s, sensorId));
      } catch (err) {
        context?.recordError?.(node.id, err);
      }
    }
    return from(normalizedSequence).pipe(
      tap((event) => context?.recordEmission?.(node.id, event))
    );
  }

  // Dynamic stream from ExecutionContext Subject
  const streamSubject = context.getOrCreateSensorSubject(sensorId);

  return streamSubject.asObservable().pipe(
    map((sample) => {
      try {
        return normalizeTelemetry(sample, sensorId);
      } catch (err) {
        context?.recordError?.(node.id, err);
        return null;
      }
    }),
    filter((event) => event !== null && (!sensorId || event.sensorId === sensorId)),
    tap((event) => context?.recordEmission?.(node.id, event))
  );
};
