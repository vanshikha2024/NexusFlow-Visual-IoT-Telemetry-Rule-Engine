/**
 * NexusFlow Visual Workflow - Graph Parser & Validator Constants
 */

export const NODE_CATEGORIES = Object.freeze({
  DATA_SOURCE: 'dataSource',
  MATH_OPERATION: 'math',
  ACTION_TRIGGER: 'action',
});

export const VALID_CATEGORIES = Object.freeze(
  new Set([
    NODE_CATEGORIES.DATA_SOURCE,
    NODE_CATEGORIES.MATH_OPERATION,
    NODE_CATEGORIES.ACTION_TRIGGER,
  ])
);

export const SUPPORTED_OPERATORS = Object.freeze(
  new Set([
    '>',
    '<',
    '>=',
    '<=',
    '==',
    '!=',
    '===',
    '!==',
    'eq',
    'neq',
    'gt',
    'lt',
    'gte',
    'lte',
  ])
);

export const SUPPORTED_MATH_OPERATIONS = Object.freeze(
  new Set([
    'scale',
    'offset',
    'add',
    'subtract',
    'multiply',
    'divide',
    'abs',
    'round',
    'floor',
    'ceil',
    'sqrt',
    'celsiusToFahrenheit',
    'fahrenheitToCelsius',
  ])
);

export const SUPPORTED_HTTP_METHODS = Object.freeze(
  new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
);

export const ERROR_CODES = Object.freeze({
  INVALID_JSON: 'INVALID_JSON',
  INVALID_STRUCTURE: 'INVALID_STRUCTURE',
  EMPTY_GRAPH: 'EMPTY_GRAPH',
  INVALID_NODE_ID: 'INVALID_NODE_ID',
  DUPLICATE_NODE_ID: 'DUPLICATE_NODE_ID',
  UNSUPPORTED_NODE_TYPE: 'UNSUPPORTED_NODE_TYPE',
  INVALID_NODE_CONFIG: 'INVALID_NODE_CONFIG',
  INVALID_EDGE_REFERENCE: 'INVALID_EDGE_REFERENCE',
  SELF_LOOP: 'SELF_LOOP',
  DUPLICATE_EDGE: 'DUPLICATE_EDGE',
  UNSUPPORTED_CONNECTION: 'UNSUPPORTED_CONNECTION',
  CYCLE_DETECTED: 'CYCLE_DETECTED',
  MISSING_SOURCE_NODE: 'MISSING_SOURCE_NODE',
  MISSING_ACTION_NODE: 'MISSING_ACTION_NODE',
  DISCONNECTED_NODE: 'DISCONNECTED_NODE',
  DISCONNECTED_NODES_REJECTED: 'DISCONNECTED_NODES_REJECTED',
  UNREACHABLE_NODE: 'UNREACHABLE_NODE',
  DEAD_END_NODE: 'DEAD_END_NODE',
});

// RxJS compiler dependency-resolution configuration.
export const DISCONNECTED_NODE_STRATEGY = Object.freeze({
  PRUNE: 'PRUNE',
  REJECT: 'REJECT',
  WARN: 'WARN',
});



