
export const nodeLibrary = [
  {
    type: "dataSource",
    label: "Temperature Sensor",
    description: "Read temperature data",
    category: "Data Sources",
    color: "#0ea5e9",
    icon: "thermometer",
  },
  {
    type: "dataSource",
    label: "Humidity Sensor",
    description: "Read humidity data",
    category: "Data Sources",
    color: "#0ea5e9",
    icon: "droplets",
  },
  {
    type: "math",
    label: "Moving Average",
    description: "Calculate average values",
    category: "Processing",
    color: "#8b5cf6",
    icon: "calculator",
  },
  {
    type: "math",
    label: "Threshold Condition",
    description: "Check a threshold value",
    category: "Processing",
    color: "#8b5cf6",
    icon: "git-branch",
  },
  {
    type: "action",
    label: "SMS Alert",
    description: "Send an SMS notification",
    category: "Actions",
    color: "#ef4444",
    icon: "message-square",
  },
{
  type: "action",
  label: "Telegram Alert",
  description: "Send a real Telegram notification",
  category: "Actions",
  color: "#229ED9",
  icon: "send",
},
  {
    type: "action",
    label: "Webhook",
    description: "Send data to an API",
    category: "Actions",
    color: "#ef4444",
    icon: "webhook",
  },
];

export const CONFIG_FIELDS = {
  "Temperature Sensor": [
    { key: "sensorId", label: "Sensor ID", input: "text" },
    { key: "unit", label: "Unit", input: "text" },
  ],
  "Humidity Sensor": [
    { key: "sensorId", label: "Sensor ID", input: "text" },
    { key: "unit", label: "Unit", input: "text" },
  ],
  "Moving Average": [
    { key: "windowSize", label: "Window Size", input: "number" },
  ],
  "Threshold Condition": [
    {
      key: "operator",
      label: "Operator",
      input: "select",
      options: [">", ">=", "<", "<=", "==", "!="],
    },
    { key: "threshold", label: "Threshold Value", input: "number" },
  ],
  "SMS Alert": [
    { key: "phone", label: "Phone Number", input: "text" },
    { key: "message", label: "Message", input: "textarea" },
  ],
  "Telegram Alert": [
    {
      key: "message",
      label: "Telegram Message",
      input: "textarea",
    },
  ],
  Webhook: [
    { key: "url", label: "Webhook URL", input: "text" },
    {
      key: "method",
      label: "HTTP Method",
      input: "select",
      options: ["POST", "PUT"],
    },
  ],
};
