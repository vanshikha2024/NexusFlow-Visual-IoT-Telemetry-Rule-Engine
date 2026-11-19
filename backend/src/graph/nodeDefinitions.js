import {
  NODE_CATEGORIES,
  SUPPORTED_OPERATORS,
  SUPPORTED_MATH_OPERATIONS,
  SUPPORTED_HTTP_METHODS,
} from './constants.js';

/**
 * Standard registry of supported node definitions in NexusFlow.
 * Each definition specifies its execution category, metadata, and configuration validator.
 */
export const DEFAULT_NODE_DEFINITIONS = {
  // --------------------------------------------------------------------------
  // Category: DATA_SOURCE (Stream Emitters / Ingestion Points)
  // --------------------------------------------------------------------------
  dataSource: {
    category: NODE_CATEGORIES.DATA_SOURCE,
    label: 'Generic Data Source',
    description: 'Ingests telemetry from external IoT sensors or time-series data',
    validateConfig: (config, node) => {
      const errors = [];
      const sensorId = config?.sensorId;
      if (!sensorId || typeof sensorId !== 'string' || sensorId.trim() === '') {
        errors.push(
          `Data source node "${node.id}" requires a non-empty string "sensorId" in config.`
        );
      }
      return errors;
    },
  },
  temperatureSensor: {
    category: NODE_CATEGORIES.DATA_SOURCE,
    label: 'Temperature Sensor',
    description: 'Reads ambient or machinery temperature telemetry',
    validateConfig: (config, node) => {
      const errors = [];
      const sensorId = config?.sensorId;
      if (!sensorId || typeof sensorId !== 'string' || sensorId.trim() === '') {
        errors.push(
          `Temperature sensor node "${node.id}" requires a non-empty string "sensorId" in config.`
        );
      }
      return errors;
    },
  },
  humiditySensor: {
    category: NODE_CATEGORIES.DATA_SOURCE,
    label: 'Humidity Sensor',
    description: 'Reads relative humidity telemetry',
    validateConfig: (config, node) => {
      const errors = [];
      const sensorId = config?.sensorId;
      if (!sensorId || typeof sensorId !== 'string' || sensorId.trim() === '') {
        errors.push(
          `Humidity sensor node "${node.id}" requires a non-empty string "sensorId" in config.`
        );
      }
      return errors;
    },
  },
  pressureSensor: {
    category: NODE_CATEGORIES.DATA_SOURCE,
    label: 'Pressure Sensor',
    description: 'Reads pressure telemetry from boilers, turbines, or pipelines',
    validateConfig: (config, node) => {
      const errors = [];
      const sensorId = config?.sensorId;
      if (!sensorId || typeof sensorId !== 'string' || sensorId.trim() === '') {
        errors.push(
          `Pressure sensor node "${node.id}" requires a non-empty string "sensorId" in config.`
        );
      }
      return errors;
    },
  },
  turbineSensor: {
    category: NODE_CATEGORIES.DATA_SOURCE,
    label: 'Turbine Sensor',
    description: 'Reads telemetry from power generation turbines',
    validateConfig: (config, node) => {
      const errors = [];
      const sensorId = config?.sensorId;
      if (!sensorId || typeof sensorId !== 'string' || sensorId.trim() === '') {
        errors.push(
          `Turbine sensor node "${node.id}" requires a non-empty string "sensorId" in config.`
        );
      }
      return errors;
    },
  },
  vibrationSensor: {
    category: NODE_CATEGORIES.DATA_SOURCE,
    label: 'Vibration Sensor',
    description: 'Reads vibration and oscillation frequencies',
    validateConfig: (config, node) => {
      const errors = [];
      const sensorId = config?.sensorId;
      if (!sensorId || typeof sensorId !== 'string' || sensorId.trim() === '') {
        errors.push(
          `Vibration sensor node "${node.id}" requires a non-empty string "sensorId" in config.`
        );
      }
      return errors;
    },
  },
  sensor: {
    category: NODE_CATEGORIES.DATA_SOURCE,
    label: 'IoT Sensor',
    validateConfig: (config, node) => {
      const errors = [];
      const sensorId = config?.sensorId;
      if (!sensorId || typeof sensorId !== 'string' || sensorId.trim() === '') {
        errors.push(
          `Sensor node "${node.id}" requires a non-empty string "sensorId" in config.`
        );
      }
      return errors;
    },
  },
  source: {
    category: NODE_CATEGORIES.DATA_SOURCE,
    label: 'Stream Source',
    validateConfig: (config, node) => {
      const errors = [];
      const sensorId = config?.sensorId;
      if (!sensorId || typeof sensorId !== 'string' || sensorId.trim() === '') {
        errors.push(
          `Source node "${node.id}" requires a non-empty string "sensorId" in config.`
        );
      }
      return errors;
    },
  },

  // --------------------------------------------------------------------------
  // Category: MATH_OPERATION (Stream Transformations, Filters, Aggregations)
  // --------------------------------------------------------------------------
  math: {
    category: NODE_CATEGORIES.MATH_OPERATION,
    label: 'Math Operation',
    description: 'Performs mathematical or logical transformations on stream data',
    validateConfig: (config = {}, node) => {
      const errors = [];
      const hasOperator = config.operator !== undefined;
      const hasThreshold = config.threshold !== undefined || config.value !== undefined;
      const hasWindow = config.windowSize !== undefined || config.window !== undefined;
      const hasOperation = config.operation !== undefined;
      const hasExpression = config.expression !== undefined || config.formula !== undefined;

      if (!hasOperator && !hasThreshold && !hasWindow && !hasOperation && !hasExpression) {
        errors.push(
          `Math node "${node.id}" requires configuration parameters (operator, threshold, windowSize, or operation).`
        );
        return errors;
      }

      if (hasOperator) {
        if (
          typeof config.operator !== 'string' ||
          !SUPPORTED_OPERATORS.has(config.operator.toLowerCase())
        ) {
          errors.push(
            `Math node "${node.id}" has invalid operator "${config.operator}". Supported: >, <, >=, <=, ==, !=.`
          );
        }
      }

      if (hasThreshold) {
        const val = config.threshold !== undefined ? config.threshold : config.value;
        if (typeof val !== 'number' || isNaN(val)) {
          errors.push(`Math node "${node.id}" threshold/value must be a valid finite number.`);
        }
      }

      if (hasWindow) {
        const win = config.windowSize !== undefined ? config.windowSize : config.window;
        if (typeof win !== 'number' || !Number.isInteger(win) || win <= 0) {
          errors.push(`Math node "${node.id}" windowSize must be a positive integer.`);
        }
      }

      return errors;
    },
  },
  threshold: {
    category: NODE_CATEGORIES.MATH_OPERATION,
    label: 'Threshold Filter',
    description: 'Filters values exceeding, below, or equal to a numerical cutoff',
    validateConfig: (config = {}, node) => {
      const errors = [];
      if (
        !config.operator ||
        typeof config.operator !== 'string' ||
        !SUPPORTED_OPERATORS.has(config.operator.toLowerCase())
      ) {
        errors.push(
          `Threshold node "${node.id}" requires a valid "operator" (e.g., '>', '<', '>=', '<=', '==', '!=').`
        );
      }
      const val = config.threshold !== undefined ? config.threshold : config.value;
      if (val === undefined || typeof val !== 'number' || isNaN(val)) {
        errors.push(
          `Threshold node "${node.id}" requires a valid numeric "threshold" or "value".`
        );
      }
      return errors;
    },
  },
  comparator: {
    category: NODE_CATEGORIES.MATH_OPERATION,
    label: 'Comparator',
    description: 'Compares incoming value against a fixed threshold or reference',
    validateConfig: (config = {}, node) => {
      const errors = [];
      if (
        !config.operator ||
        typeof config.operator !== 'string' ||
        !SUPPORTED_OPERATORS.has(config.operator.toLowerCase())
      ) {
        errors.push(
          `Comparator node "${node.id}" requires a valid "operator" (e.g., '>', '<', '>=', '<=', '==', '!=').`
        );
      }
      const val = config.threshold !== undefined ? config.threshold : config.value;
      if (val === undefined || typeof val !== 'number' || isNaN(val)) {
        errors.push(
          `Comparator node "${node.id}" requires a valid numeric "threshold" or "value".`
        );
      }
      return errors;
    },
  },
  movingAverage: {
    category: NODE_CATEGORIES.MATH_OPERATION,
    label: 'Moving Average Filter',
    description: 'Computes rolling average over a sliding window of sensor samples',
    validateConfig: (config = {}, node) => {
      const errors = [];
      const win = config.windowSize !== undefined ? config.windowSize : config.window;
      if (win === undefined || typeof win !== 'number' || !Number.isInteger(win) || win <= 0) {
        errors.push(
          `Moving average node "${node.id}" requires a positive integer "windowSize" (e.g., 5, 10).`
        );
      }
      return errors;
    },
  },
  average: {
    category: NODE_CATEGORIES.MATH_OPERATION,
    label: 'Rolling Average Filter',
    validateConfig: (config = {}, node) => {
      const errors = [];
      const win = config.windowSize !== undefined ? config.windowSize : config.window;
      if (win === undefined || typeof win !== 'number' || !Number.isInteger(win) || win <= 0) {
        errors.push(
          `Average node "${node.id}" requires a positive integer "windowSize" (e.g., 5, 10).`
        );
      }
      return errors;
    },
  },
  filter: {
    category: NODE_CATEGORIES.MATH_OPERATION,
    label: 'Filter',
    description: 'Discards stream values not meeting specified criteria',
    validateConfig: (config = {}, node) => {
      const errors = [];
      const hasOperator =
        config.operator &&
        SUPPORTED_OPERATORS.has(String(config.operator).toLowerCase());
      const hasThreshold =
        (config.threshold !== undefined &&
          typeof config.threshold === 'number' &&
          !isNaN(config.threshold)) ||
        (config.value !== undefined &&
          typeof config.value === 'number' &&
          !isNaN(config.value));
      const hasPredicate =
        typeof config.predicate === 'string' && config.predicate.trim().length > 0;

      if (!((hasOperator && hasThreshold) || hasPredicate)) {
        errors.push(
          `Filter node "${node.id}" requires either a valid operator and numeric threshold, or a predicate string.`
        );
      }
      return errors;
    },
  },
  transform: {
    category: NODE_CATEGORIES.MATH_OPERATION,
    label: 'Data Transform',
    description: 'Transforms telemetry data via scaling, unit conversion, or offsets',
    validateConfig: (config = {}, node) => {
      const errors = [];
      if (!config.operation && config.factor === undefined && config.offset === undefined) {
        errors.push(
          `Transform node "${node.id}" requires an "operation" (e.g. celsiusToFahrenheit, scale), "factor", or "offset".`
        );
      }
      if (config.operation && typeof config.operation === 'string') {
        if (!SUPPORTED_MATH_OPERATIONS.has(config.operation)) {
          errors.push(
            `Transform node "${node.id}" has unsupported operation "${config.operation}". Supported: ${Array.from(SUPPORTED_MATH_OPERATIONS).join(', ')}.`
          );
        }
      }
      return errors;
    },
  },
  expression: {
    category: NODE_CATEGORIES.MATH_OPERATION,
    label: 'Declarative Expression',
    description: 'Safe declarative arithmetic/metric expression (strictly NO eval)',
    validateConfig: (config = {}, node) => {
      const errors = [];
      // Strictly prevent execution of arbitrary code: validate declarative fields
      const hasExpr = config.expression || config.formula || (config.field && config.operator);
      if (!hasExpr) {
        errors.push(
          `Expression node "${node.id}" requires a declarative "expression", "formula", or "field" configuration.`
        );
      }
      return errors;
    },
  },

  // --------------------------------------------------------------------------
  // Category: ACTION_TRIGGER (Terminal Sinks / Alerts / Notifications)
  // --------------------------------------------------------------------------
  action: {
    category: NODE_CATEGORIES.ACTION_TRIGGER,
    label: 'Generic Action Trigger',
    description: 'Consumes stream results and executes alerts or side effects',
    validateConfig: (config = {}, node) => {
      const errors = [];
      const hasTarget =
        config.recipient ||
        config.phone ||
        config.url ||
        config.topic ||
        config.channel ||
        config.message;
      if (!hasTarget) {
        errors.push(
          `Action node "${node.id}" requires target parameters in config (recipient, url, topic, channel, or message).`
        );
      }
      return errors;
    },
  },
  smsAlert: {
    category: NODE_CATEGORIES.ACTION_TRIGGER,
    label: 'SMS Alert Trigger',
    description: 'Sends emergency SMS notifications to on-call engineers',
    validateConfig: (config = {}, node) => {
      const errors = [];
      const recipient = config.recipient || config.phone;
      if (!recipient || typeof recipient !== 'string' || recipient.trim() === '') {
        errors.push(
          `SMS alert node "${node.id}" requires a non-empty string "recipient" or "phone".`
        );
      }
      return errors;
    },
  },
  sms: {
    category: NODE_CATEGORIES.ACTION_TRIGGER,
    label: 'SMS Alert',
    validateConfig: (config = {}, node) => {
      const errors = [];
      const recipient = config.recipient || config.phone;
      if (!recipient || typeof recipient !== 'string' || recipient.trim() === '') {
        errors.push(
          `SMS alert node "${node.id}" requires a non-empty string "recipient" or "phone".`
        );
      }
      return errors;
    },
  },
  webhook: {
    category: NODE_CATEGORIES.ACTION_TRIGGER,
    label: 'Webhook Trigger',
    description: 'Dispatches HTTP payloads to third-party endpoints',
    validateConfig: (config = {}, node) => {
      const errors = [];
      if (!config.url || typeof config.url !== 'string' || config.url.trim() === '') {
        errors.push(`Webhook node "${node.id}" requires a non-empty string "url".`);
      } else {
        try {
          const parsed = new URL(config.url.trim());
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            errors.push(`Webhook node "${node.id}" URL must use http:// or https:// protocol.`);
          }
        } catch {
          errors.push(`Webhook node "${node.id}" has an invalid URL format ("${config.url}").`);
        }
      }
      if (config.method) {
        if (
          typeof config.method !== 'string' ||
          !SUPPORTED_HTTP_METHODS.has(config.method.toUpperCase())
        ) {
          errors.push(
            `Webhook node "${node.id}" has invalid HTTP method "${config.method}". Supported: GET, POST, PUT, PATCH, DELETE.`
          );
        }
      }
      return errors;
    },
  },
  http: {
    category: NODE_CATEGORIES.ACTION_TRIGGER,
    label: 'HTTP Request Trigger',
    validateConfig: (config = {}, node) => {
      const errors = [];
      if (!config.url || typeof config.url !== 'string' || config.url.trim() === '') {
        errors.push(`HTTP trigger node "${node.id}" requires a non-empty string "url".`);
      }
      return errors;
    },
  },
  emailNotification: {
    category: NODE_CATEGORIES.ACTION_TRIGGER,
    label: 'Email Notification Trigger',
    description: 'Sends email alert messages',
    validateConfig: (config = {}, node) => {
      const errors = [];
      const recipient = config.recipient || config.email || config.to;
      if (!recipient || typeof recipient !== 'string' || recipient.trim() === '') {
        errors.push(
          `Email notification node "${node.id}" requires a non-empty string "recipient" or "email".`
        );
      } else if (!recipient.includes('@') || !recipient.includes('.')) {
        errors.push(
          `Email notification node "${node.id}" has an invalid email format ("${recipient}").`
        );
      }
      return errors;
    },
  },
  email: {
    category: NODE_CATEGORIES.ACTION_TRIGGER,
    label: 'Email Alert',
    validateConfig: (config = {}, node) => {
      const errors = [];
      const recipient = config.recipient || config.email || config.to;
      if (!recipient || typeof recipient !== 'string' || recipient.trim() === '') {
        errors.push(
          `Email node "${node.id}" requires a non-empty string "recipient" or "email".`
        );
      }
      return errors;
    },
  },
  mqttPublish: {
    category: NODE_CATEGORIES.ACTION_TRIGGER,
    label: 'MQTT Publish Trigger',
    description: 'Publishes control signals or events back to MQTT broker',
    validateConfig: (config = {}, node) => {
      const errors = [];
      if (!config.topic || typeof config.topic !== 'string' || config.topic.trim() === '') {
        errors.push(
          `MQTT publish node "${node.id}" requires a non-empty string "topic".`
        );
      }
      return errors;
    },
  },
  mqtt: {
    category: NODE_CATEGORIES.ACTION_TRIGGER,
    label: 'MQTT Publisher',
    validateConfig: (config = {}, node) => {
      const errors = [];
      if (!config.topic || typeof config.topic !== 'string' || config.topic.trim() === '') {
        errors.push(
          `MQTT node "${node.id}" requires a non-empty string "topic".`
        );
      }
      return errors;
    },
  },
  alert: {
    category: NODE_CATEGORIES.ACTION_TRIGGER,
    label: 'Alert Trigger',
    validateConfig: (config = {}, node) => {
      const errors = [];
      const hasTarget =
        config.recipient ||
        config.phone ||
        config.url ||
        config.topic ||
        config.channel ||
        config.message;
      if (!hasTarget) {
        errors.push(`Alert node "${node.id}" requires target or message configuration.`);
      }
      return errors;
    },
  },
  sink: {
    category: NODE_CATEGORIES.ACTION_TRIGGER,
    label: 'Stream Sink',
    validateConfig: (config = {}, node) => {
      const errors = [];
      const hasTarget =
        config.recipient ||
        config.url ||
        config.topic ||
        config.message ||
        config.target;
      if (!hasTarget) {
        errors.push(`Sink node "${node.id}" requires target or message configuration.`);
      }
      return errors;
    },
  },
};

/**
 * Extensible Node Registry
 */
export class NodeRegistry {
  constructor(initialDefinitions = DEFAULT_NODE_DEFINITIONS) {
    this.definitions = new Map();
    for (const [key, def] of Object.entries(initialDefinitions)) {
      this.definitions.set(key.toLowerCase(), def);
    }
  }

  /**
   * Registers a new or custom node type.
   *
   * @param {string} typeName
   * @param {{ category: string, label?: string, description?: string, validateConfig?: Function }} definition
   */
  registerNodeType(typeName, definition) {
    if (!typeName || typeof typeName !== 'string' || typeName.trim() === '') {
      throw new Error('Node typeName must be a non-empty string.');
    }
    if (!definition || !definition.category) {
      throw new Error(
        'Node definition must specify a "category" (dataSource, math, or action).'
      );
    }
    this.definitions.set(typeName.trim().toLowerCase(), definition);
  }

  /**
   * Checks if a node type is supported.
   *
   * @param {string} typeName
   * @returns {boolean}
   */
  isSupported(typeName) {
    if (!typeName || typeof typeName !== 'string') return false;
    return this.definitions.has(typeName.trim().toLowerCase());
  }

  /**
   * Retrieves definition for a node type.
   *
   * @param {string} typeName
   * @returns {Object|null}
   */
  getDefinition(typeName) {
    if (!typeName || typeof typeName !== 'string') return null;
    return this.definitions.get(typeName.trim().toLowerCase()) || null;
  }

  /**
   * Gets category for a node type.
   *
   * @param {string} typeName
   * @returns {string|null}
   */
  getCategory(typeName) {
    const def = this.getDefinition(typeName);
    return def ? def.category : null;
  }

  /**
   * Returns list of all supported node type names.
   *
   * @returns {string[]}
   */
  getAllSupportedTypes() {
    return Array.from(this.definitions.keys());
  }
}

export const defaultRegistry = new NodeRegistry();
