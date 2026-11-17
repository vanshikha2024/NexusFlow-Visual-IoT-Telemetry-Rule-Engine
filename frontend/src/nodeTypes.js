export const NODE_LIBRARY = [
  { type: 'dataSource', label: 'Temperature Sensor', category: 'Data Source', color: '#0ea5e9' },
  { type: 'dataSource', label: 'Humidity Sensor', category: 'Data Source', color: '#0ea5e9' },
  { type: 'math', label: 'Moving Average Filter', category: 'Math Operation', color: '#8b5cf6' },
  { type: 'math', label: 'Threshold Condition', category: 'Math Operation', color: '#8b5cf6' },
  { type: 'action', label: 'SMS Alert', category: 'Action Trigger', color: '#ef4444' },
  { type: 'action', label: 'Webhook', category: 'Action Trigger', color: '#ef4444' },
];

// Fields shown in the settings panel for each node type.
export const CONFIG_FIELDS = {
  turbineSensor: [
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
    { key: 'value', label: 'Value', input: 'number' },
  ],
  smsAlert: [
    { key: 'phone', label: 'Phone number', input: 'text' },
    { key: 'message', label: 'Message (use {{value}})', input: 'textarea' },
  ],
  webhook: [
    { key: 'url', label: 'Webhook URL', input: 'text' },
    { key: 'method', label: 'Method', input: 'select', options: ['POST'] },
  ],
};