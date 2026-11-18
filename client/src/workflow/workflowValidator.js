
export function validateWorkflow(nodes, edges) {
  const errors = [];

  if (!nodes.length) {
    return ["Workflow is empty. Add some nodes first."];
  }

  const nodeIds = new Set(nodes.map((node) => node.id));

  // Check duplicate node IDs
  if (nodeIds.size !== nodes.length) {
    errors.push("Duplicate node IDs found.");
  }

  // Check node configurations
  nodes.forEach((node) => {
    const config = node.data?.config || {};
    const label = node.data?.label || "Unknown Node";

    const required = (key, field) => {
      if (
        config[key] === undefined ||
        config[key] === null ||
        String(config[key]).trim() === ""
      ) {
        errors.push(`${label}: ${field} is required.`);
        return false;
      }
      return true;
    };

    if (
      label === "Temperature Sensor" ||
      label === "Humidity Sensor"
    ) {
      required("sensorId", "Sensor ID");
      required("unit", "Unit");
    }

    if (label === "Moving Average") {
      if (required("windowSize", "Window Size")) {
        if (
          !Number.isInteger(Number(config.windowSize)) ||
          Number(config.windowSize) <= 0
        ) {
          errors.push(
            `${label}: Window Size must be a positive integer.`
          );
        }
      }
    }

    if (label === "Threshold Condition") {
      if (required("operator", "Operator")) {
        const operators = [">", ">=", "<", "<=", "==", "!="];

        if (!operators.includes(config.operator)) {
          errors.push(`${label}: Invalid operator.`);
        }
      }

      if (required("threshold", "Threshold Value")) {
        if (!Number.isFinite(Number(config.threshold))) {
          errors.push(`${label}: Threshold must be a valid number.`);
        }
      }
    }

    if (label === "SMS Alert") {
      if (required("phone", "Phone Number")) {
        if (!/^\+?[0-9]{10,15}$/.test(config.phone.trim())) {
          errors.push(`${label}: Enter a valid phone number.`);
        }
      }

      required("message", "Message");
    }

    if (label === "Webhook") {
      if (required("url", "Webhook URL")) {
        try {
          const url = new URL(config.url);

          if (!["http:", "https:"].includes(url.protocol)) {
            errors.push(`${label}: URL must use HTTP or HTTPS.`);
          }
        } catch {
          errors.push(`${label}: Enter a valid URL.`);
        }
      }

      if (required("method", "HTTP Method")) {
        if (!["POST", "PUT"].includes(config.method)) {
          errors.push(`${label}: Invalid HTTP method.`);
        }
      }
    }
  });

  // Check connections
  const incoming = new Set();
  const outgoing = new Set();

  edges.forEach((edge) => {
    const source = nodes.find((node) => node.id === edge.source);
    const target = nodes.find((node) => node.id === edge.target);

    if (!source || !target) {
      errors.push("A connection references a missing node.");
      return;
    }

    if (edge.source === edge.target) {
      errors.push("A node cannot connect to itself.");
      return;
    }

    incoming.add(edge.target);
    outgoing.add(edge.source);

    const sourceType = source.type;
    const targetType = target.type;

    const validConnection =
      (sourceType === "dataSource" && targetType === "math") ||
      (sourceType === "math" && targetType === "math") ||
      (sourceType === "math" && targetType === "action");

    if (!validConnection) {
      errors.push(
        `Invalid connection: ${source.data.label} → ${target.data.label}.`
      );
    }
  });

  // Check disconnected nodes
  nodes.forEach((node) => {
    if (!incoming.has(node.id) && !outgoing.has(node.id)) {
      errors.push(`${node.data.label}: Node is disconnected.`);
      return;
    }

    if (node.type === "dataSource" && incoming.has(node.id)) {
      errors.push(
        `${node.data.label}: Data source cannot have incoming connections.`
      );
    }

    if (node.type === "action" && outgoing.has(node.id)) {
      errors.push(
        `${node.data.label}: Action cannot have outgoing connections.`
      );
    }

    if (node.type === "math") {
      if (!incoming.has(node.id)) {
        errors.push(`${node.data.label}: Processing node needs an input.`);
      }

      if (!outgoing.has(node.id)) {
        errors.push(`${node.data.label}: Processing node needs an output.`);
      }
    }
  });

  return [...new Set(errors)];
}
