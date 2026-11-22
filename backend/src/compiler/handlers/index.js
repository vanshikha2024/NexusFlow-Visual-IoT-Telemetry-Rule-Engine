import { createDataSourceObservable, normalizeTelemetry } from './dataSource.handler.js';
import { createMovingAverageOperator } from './movingAverage.handler.js';
import { createThresholdOperator, evaluateComparison } from './threshold.handler.js';
import { createSmsAlertSink, resetAlertCounter } from './sms.handler.js';
import { createMathOperator, evaluateMathOperation } from './math.handler.js';
import { createGenericSink } from './sink.handler.js';

export {
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
};

/**
 * Handler Factory Registry
 * Resolves any visual workflow node type to its corresponding RxJS operator/source/sink factory.
 */
export const HANDLER_FACTORIES = {
  // Data Sources
  datasource: createDataSourceObservable,
  temperaturesensor: createDataSourceObservable,
  humiditysensor: createDataSourceObservable,
  pressuresensor: createDataSourceObservable,
  turbinesensor: createDataSourceObservable,
  vibrationsensor: createDataSourceObservable,
  sensor: createDataSourceObservable,
  source: createDataSourceObservable,

  // Moving Average Operators
  movingaverage: createMovingAverageOperator,
  average: createMovingAverageOperator,

  // Threshold / Filter Operators
  threshold: createThresholdOperator,
  comparator: createThresholdOperator,

  // Math & Transformations
  transform: createMathOperator,
  math: createMathOperator,
  expression: createMathOperator,

  // SMS Sinks (Mock)
  smsalert: createSmsAlertSink,
  sms: createSmsAlertSink,

  // Other Action Sinks (Mock)
  webhook: createGenericSink,
  http: createGenericSink,
  emailnotification: createGenericSink,
  email: createGenericSink,
  mqttpublish: createGenericSink,
  mqtt: createGenericSink,
  action: createGenericSink,
  alert: createGenericSink,
  sink: createGenericSink,
};

/**
 * Resolves the handler factory for a given node.
 *
 * @param {Object} node
 * @returns {Function|null}
 */
export const resolveHandlerFactory = (node) => {
  if (!node || !node.type) return null;
  const key = String(node.type).trim().toLowerCase();
  if (HANDLER_FACTORIES[key]) {
    return HANDLER_FACTORIES[key];
  }

  // Category fallback
  if (node.category) {
    const catKey = String(node.category).trim().toLowerCase();
    if (catKey === 'datasource' || catKey === 'data_source') return createDataSourceObservable;
    if (catKey === 'action' || catKey === 'action_trigger') return createGenericSink;
    if (catKey === 'math' || catKey === 'math_operation') return createMathOperator;
  }

  return null;
};
