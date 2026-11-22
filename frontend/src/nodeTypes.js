// "type" values match the backend compiler's node type names.
export const NODE_LIBRARY = [
  { type: 'turbineSensor', label: 'Turbine Sensor', category: 'Data Source', color: '#0ea5e9', config: { sensorId: 'turbine-sensor-01', unit: 'RPM' } },
  { type: 'temperatureSensor', label: 'Temperature Sensor', category: 'Data Source', color: '#0ea5e9', config: { sensorId: 'temp-sensor-01', unit: '°C' } },
  { type: 'humiditySensor', label: 'Humidity Sensor', category: 'Data Source', color: '#0ea5e9', config: { sensorId: 'humidity-sensor-01', unit: '%' } },
  { type: 'movingAverage', label: 'Moving Average Filter', category: 'Math Operation', color: '#8b5cf6', config: { windowSize: 5 } },
  { type: 'threshold', label: 'Threshold', category: 'Math Operation', color: '#8b5cf6', config: { operator: '>', threshold: 80 } },
  { type: 'smsAlert', label: 'SMS Alert', category: 'Action Trigger', color: '#ef4444', config: { recipient: '', message: 'Alert! Value: {{value}}' } },
  { type: 'webhook', label: 'Webhook', category: 'Action Trigger', color: '#ef4444', config: { url: '', method: 'POST' } },
];

// Fields shown in the settings panel for each node type.
export const CONFIG_FIELDS = {
  turbineSensor: [
    { key: 'sensorId', label: 'Sensor ID', input: 'text' },
    { key: 'unit', label: 'Unit', input: 'text' },
  ],
  humiditySensor: [
    { key: 'sensorId', label: 'Sensor ID', input: 'text' },
    { key: 'unit', label: 'Unit', input: 'text' },
  ],
  temperatureSensor: [
    { key: 'sensorId', label: 'Sensor ID', input: 'text' },
    { key: 'unit', label: 'Unit', input: 'text' },
  ],
  movingAverage: [
    { key: 'windowSize', label: 'Window size (readings)', input: 'number' },
  ],
  threshold: [
    { key: 'operator', label: 'Operator', input: 'select', options: ['>', '>=', '<', '<=', '==', '!='] },
    { key: 'threshold', label: 'Threshold value', input: 'number' },
  ],
  smsAlert: [
    { key: 'recipient', label: 'Phone number', input: 'text' },
    { key: 'message', label: 'Message (use {{value}})', input: 'textarea' },
  ],
  webhook: [
    { key: 'url', label: 'Webhook URL', input: 'text' },
    { key: 'method', label: 'Method', input: 'select', options: ['POST'] },
  ],
};

// Short text shown on the node so users can see its settings at a glance.
export function getNodeSummary(type, config = {}) {
  switch (type) {
    case 'turbineSensor':
    case 'temperatureSensor':
    case 'humiditySensor':
      return `${config.sensorId || 'no sensor ID'}${config.unit ? ` (${config.unit})` : ''}`;
    case 'movingAverage':
      return `window: ${config.windowSize ?? '-'} readings`;
    case 'threshold':
      return `value ${config.operator ?? ''} ${config.threshold ?? ''}`;
    case 'smsAlert':
      return config.recipient || 'no phone set';
    case 'webhook':
      return config.url || 'no URL set';
    default:
      return '';
  }
}