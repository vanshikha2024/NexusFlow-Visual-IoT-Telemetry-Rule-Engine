const NODE_CATEGORIES = {
  DATA_SOURCE: 'dataSource',
  MATH_OPERATION: 'math',
  ACTION_TRIGGER: 'action',
};

const HANDLER_TYPES = {
  SOURCE: 'source',
  OPERATOR: 'operator',
  SINK: 'sink',
};

/**
 * Standard backend execution handler descriptors.
 * Maps visual canvas node types to their corresponding Day 9 RxJS compiler operators/sinks.
 */
export const DEFAULT_HANDLER_MAPPINGS = {
  // --------------------------------------------------------------------------
  // Data Sources (Stream Emitters / Observables)
  // --------------------------------------------------------------------------
  dataSource: {
    handlerId: 'telemetrySourceHandler',
    handlerName: 'Telemetry Source Stream',
    category: NODE_CATEGORIES.DATA_SOURCE,
    handlerType: HANDLER_TYPES.SOURCE,
    description: 'Subscribes to incoming IoT telemetry events matching sensorId',
    rxPattern: 'telemetryStream',
    inputs: 0,
    outputs: 1,
    requiredConfig: ['sensorId'],
  },
  temperatureSensor: {
    handlerId: 'temperatureSensorHandler',
    handlerName: 'Temperature Sensor Stream',
    category: NODE_CATEGORIES.DATA_SOURCE,
    handlerType: HANDLER_TYPES.SOURCE,
    description: 'Generates telemetry stream for temperature readings',
    rxPattern: 'telemetryStream',
    inputs: 0,
    outputs: 1,
    requiredConfig: ['sensorId'],
  },
  humiditySensor: {
    handlerId: 'humiditySensorHandler',
    handlerName: 'Humidity Sensor Stream',
    category: NODE_CATEGORIES.DATA_SOURCE,
    handlerType: HANDLER_TYPES.SOURCE,
    description: 'Generates telemetry stream for relative humidity readings',
    rxPattern: 'telemetryStream',
    inputs: 0,
    outputs: 1,
    requiredConfig: ['sensorId'],
  },
  pressureSensor: {
    handlerId: 'pressureSensorHandler',
    handlerName: 'Pressure Sensor Stream',
    category: NODE_CATEGORIES.DATA_SOURCE,
    handlerType: HANDLER_TYPES.SOURCE,
    description: 'Generates telemetry stream for boiler or pipeline pressure',
    rxPattern: 'telemetryStream',
    inputs: 0,
    outputs: 1,
    requiredConfig: ['sensorId'],
  },
  turbineSensor: {
    handlerId: 'turbineSensorHandler',
    handlerName: 'Turbine Sensor Stream',
    category: NODE_CATEGORIES.DATA_SOURCE,
    handlerType: HANDLER_TYPES.SOURCE,
    description: 'Generates telemetry stream for turbine rotational RPM and vibration',
    rxPattern: 'telemetryStream',
    inputs: 0,
    outputs: 1,
    requiredConfig: ['sensorId'],
  },
  vibrationSensor: {
    handlerId: 'vibrationSensorHandler',
    handlerName: 'Vibration Sensor Stream',
    category: NODE_CATEGORIES.DATA_SOURCE,
    handlerType: HANDLER_TYPES.SOURCE,
    description: 'Generates telemetry stream for oscillation and vibration telemetry',
    rxPattern: 'telemetryStream',
    inputs: 0,
    outputs: 1,
    requiredConfig: ['sensorId'],
  },
  sensor: {
    handlerId: 'telemetrySourceHandler',
    handlerName: 'Generic Sensor Stream',
    category: NODE_CATEGORIES.DATA_SOURCE,
    handlerType: HANDLER_TYPES.SOURCE,
    description: 'Generic sensor event stream source',
    rxPattern: 'telemetryStream',
    inputs: 0,
    outputs: 1,
    requiredConfig: ['sensorId'],
  },
  source: {
    handlerId: 'telemetrySourceHandler',
    handlerName: 'Stream Source',
    category: NODE_CATEGORIES.DATA_SOURCE,
    handlerType: HANDLER_TYPES.SOURCE,
    description: 'Generic stream root entrypoint',
    rxPattern: 'telemetryStream',
    inputs: 0,
    outputs: 1,
    requiredConfig: ['sensorId'],
  },

  // --------------------------------------------------------------------------
  // Math & Logic Operators (RxJS Pipe Operators)
  // --------------------------------------------------------------------------
  threshold: {
    handlerId: 'thresholdFilterHandler',
    handlerName: 'Threshold Filter Operator',
    category: NODE_CATEGORIES.MATH_OPERATION,
    handlerType: HANDLER_TYPES.OPERATOR,
    description: 'Filters telemetry stream matching comparison threshold operator',
    rxPattern: 'filter',
    inputs: 1,
    outputs: 1,
    requiredConfig: ['operator', 'threshold'],
  },
  comparator: {
    handlerId: 'thresholdFilterHandler',
    handlerName: 'Comparator Filter Operator',
    category: NODE_CATEGORIES.MATH_OPERATION,
    handlerType: HANDLER_TYPES.OPERATOR,
    description: 'Compares incoming telemetry value against benchmark threshold',
    rxPattern: 'filter',
    inputs: 1,
    outputs: 1,
    requiredConfig: ['operator', 'threshold'],
  },
  movingAverage: {
    handlerId: 'movingAverageHandler',
    handlerName: 'Moving Average Sliding Window Operator',
    category: NODE_CATEGORIES.MATH_OPERATION,
    handlerType: HANDLER_TYPES.OPERATOR,
    description: 'Calculates rolling average over sliding window buffer of sensor samples',
    rxPattern: 'scan',
    inputs: 1,
    outputs: 1,
    requiredConfig: ['windowSize'],
  },
  average: {
    handlerId: 'movingAverageHandler',
    handlerName: 'Rolling Average Operator',
    category: NODE_CATEGORIES.MATH_OPERATION,
    handlerType: HANDLER_TYPES.OPERATOR,
    description: 'Sliding window buffer rolling average',
    rxPattern: 'scan',
    inputs: 1,
    outputs: 1,
    requiredConfig: ['windowSize'],
  },
  transform: {
    handlerId: 'dataTransformHandler',
    handlerName: 'Data Transform Operator',
    category: NODE_CATEGORIES.MATH_OPERATION,
    handlerType: HANDLER_TYPES.OPERATOR,
    description: 'Maps telemetry samples through scaling, offset, or unit conversion functions',
    rxPattern: 'map',
    inputs: 1,
    outputs: 1,
    requiredConfig: [],
  },
  filter: {
    handlerId: 'predicateFilterHandler',
    handlerName: 'Predicate Filter Operator',
    category: NODE_CATEGORIES.MATH_OPERATION,
    handlerType: HANDLER_TYPES.OPERATOR,
    description: 'General condition predicate stream filter',
    rxPattern: 'filter',
    inputs: 1,
    outputs: 1,
    requiredConfig: [],
  },
  expression: {
    handlerId: 'declarativeExpressionHandler',
    handlerName: 'Declarative Expression Operator',
    category: NODE_CATEGORIES.MATH_OPERATION,
    handlerType: HANDLER_TYPES.OPERATOR,
    description: 'Evaluates safe arithmetic expression tokens (strictly zero eval)',
    rxPattern: 'map',
    inputs: 1,
    outputs: 1,
    requiredConfig: [],
  },
  math: {
    handlerId: 'mathOperationHandler',
    handlerName: 'Math Operation Operator',
    category: NODE_CATEGORIES.MATH_OPERATION,
    handlerType: HANDLER_TYPES.OPERATOR,
    description: 'Generic mathematical transformation operator',
    rxPattern: 'map',
    inputs: 1,
    outputs: 1,
    requiredConfig: [],
  },

  // --------------------------------------------------------------------------
  // Action Triggers & Sinks (RxJS Terminal Consumers / Sinks)
  // --------------------------------------------------------------------------
  smsAlert: {
    handlerId: 'smsAlertHandler',
    handlerName: 'SMS Alert Sink',
    category: NODE_CATEGORIES.ACTION_TRIGGER,
    handlerType: HANDLER_TYPES.SINK,
    description: 'Dispatches emergency SMS alert to mobile recipient',
    rxPattern: 'tap',
    inputs: 1,
    outputs: 0,
    requiredConfig: ['recipient'],
  },
  sms: {
    handlerId: 'smsAlertHandler',
    handlerName: 'SMS Alert Sink',
    category: NODE_CATEGORIES.ACTION_TRIGGER,
    handlerType: HANDLER_TYPES.SINK,
    description: 'Dispatches emergency SMS alert',
    rxPattern: 'tap',
    inputs: 1,
    outputs: 0,
    requiredConfig: ['recipient'],
  },
  webhook: {
    handlerId: 'webhookDispatchHandler',
    handlerName: 'Webhook Dispatch Sink',
    category: NODE_CATEGORIES.ACTION_TRIGGER,
    handlerType: HANDLER_TYPES.SINK,
    description: 'Dispatches HTTP payload to external webhook endpoint',
    rxPattern: 'tap',
    inputs: 1,
    outputs: 0,
    requiredConfig: ['url'],
  },
  http: {
    handlerId: 'webhookDispatchHandler',
    handlerName: 'HTTP Request Sink',
    category: NODE_CATEGORIES.ACTION_TRIGGER,
    handlerType: HANDLER_TYPES.SINK,
    description: 'Dispatches HTTP request payload',
    rxPattern: 'tap',
    inputs: 1,
    outputs: 0,
    requiredConfig: ['url'],
  },
  emailNotification: {
    handlerId: 'emailNotificationHandler',
    handlerName: 'Email Notification Sink',
    category: NODE_CATEGORIES.ACTION_TRIGGER,
    handlerType: HANDLER_TYPES.SINK,
    description: 'Sends email alert message to notification recipient',
    rxPattern: 'tap',
    inputs: 1,
    outputs: 0,
    requiredConfig: ['recipient'],
  },
  email: {
    handlerId: 'emailNotificationHandler',
    handlerName: 'Email Alert Sink',
    category: NODE_CATEGORIES.ACTION_TRIGGER,
    handlerType: HANDLER_TYPES.SINK,
    description: 'Sends alert email',
    rxPattern: 'tap',
    inputs: 1,
    outputs: 0,
    requiredConfig: ['recipient'],
  },
  mqttPublish: {
    handlerId: 'mqttPublishHandler',
    handlerName: 'MQTT Publish Sink',
    category: NODE_CATEGORIES.ACTION_TRIGGER,
    handlerType: HANDLER_TYPES.SINK,
    description: 'Publishes control signals or events to broker MQTT topic',
    rxPattern: 'tap',
    inputs: 1,
    outputs: 0,
    requiredConfig: ['topic'],
  },
  mqtt: {
    handlerId: 'mqttPublishHandler',
    handlerName: 'MQTT Publish Sink',
    category: NODE_CATEGORIES.ACTION_TRIGGER,
    handlerType: HANDLER_TYPES.SINK,
    description: 'Publishes message to MQTT topic',
    rxPattern: 'tap',
    inputs: 1,
    outputs: 0,
    requiredConfig: ['topic'],
  },
  action: {
    handlerId: 'genericActionHandler',
    handlerName: 'Generic Action Sink',
    category: NODE_CATEGORIES.ACTION_TRIGGER,
    handlerType: HANDLER_TYPES.SINK,
    description: 'Executes generic action trigger',
    rxPattern: 'tap',
    inputs: 1,
    outputs: 0,
    requiredConfig: [],
  },
  alert: {
    handlerId: 'genericActionHandler',
    handlerName: 'Alert Sink',
    category: NODE_CATEGORIES.ACTION_TRIGGER,
    handlerType: HANDLER_TYPES.SINK,
    description: 'Executes alert notification',
    rxPattern: 'tap',
    inputs: 1,
    outputs: 0,
    requiredConfig: [],
  },
  sink: {
    handlerId: 'genericActionHandler',
    handlerName: 'Stream Sink',
    category: NODE_CATEGORIES.ACTION_TRIGGER,
    handlerType: HANDLER_TYPES.SINK,
    description: 'Consumes and terminates stream pipeline',
    rxPattern: 'tap',
    inputs: 1,
    outputs: 0,
    requiredConfig: [],
  },
};

/**
 * Execution Handler Registry
 * Provides mapping between React Flow graph node types and Day 9 backend execution handlers.
 */
export class ExecutionHandlerRegistry {
  constructor(initialMappings = DEFAULT_HANDLER_MAPPINGS) {
    this.handlers = new Map();
    for (const [nodeType, descriptor] of Object.entries(initialMappings)) {
      this.handlers.set(nodeType.toLowerCase(), {
        nodeType,
        ...descriptor,
      });
    }
  }

  /**
   * Registers a custom node execution handler descriptor.
   *
   * @param {string} nodeType
   * @param {Object} descriptor
   */
  registerHandler(nodeType, descriptor) {
    if (!nodeType || typeof nodeType !== 'string' || nodeType.trim() === '') {
      throw new Error('Handler nodeType must be a non-empty string.');
    }
    if (!descriptor || !descriptor.handlerId || !descriptor.category) {
      throw new Error('Handler descriptor must contain "handlerId" and "category".');
    }
    this.handlers.set(nodeType.trim().toLowerCase(), {
      nodeType: nodeType.trim(),
      ...descriptor,
    });
  }

  /**
   * Retrieves handler descriptor for a given node type.
   *
   * @param {string} nodeType
   * @returns {Object|null}
   */
  getHandler(nodeType) {
    if (!nodeType || typeof nodeType !== 'string') return null;
    return this.handlers.get(nodeType.trim().toLowerCase()) || null;
  }

  /**
   * Checks whether a handler is registered for a given node type.
   *
   * @param {string} nodeType
   * @returns {boolean}
   */
  hasHandler(nodeType) {
    if (!nodeType || typeof nodeType !== 'string') return false;
    return this.handlers.has(nodeType.trim().toLowerCase());
  }

  /**
   * Resolves handler for a given node object (fallback to category if specific type unmapped).
   *
   * @param {{ type: string, category?: string }} node
   * @returns {Object|null}
   */
  getHandlerForNode(node) {
    if (!node || !node.type) return null;
    const direct = this.getHandler(node.type);
    if (direct) return direct;

    // Fallback based on category
    if (node.category) {
      return this.getHandler(node.category);
    }
    return null;
  }

  /**
   * Returns all registered handler mappings as an array.
   *
   * @returns {Array<Object>}
   */
  getAllHandlers() {
    return Array.from(this.handlers.values());
  }
}

export const defaultHandlerRegistry = new ExecutionHandlerRegistry();
