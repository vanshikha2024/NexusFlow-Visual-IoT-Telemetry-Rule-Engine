// Rules for which nodes may connect, and what makes a workflow ready to save.

function createsCycle(source, target, edges) {
  // If we can already walk from target back to source, adding source -> target makes a loop.
  const stack = [target];
  const seen = new Set();
  while (stack.length) {
    const id = stack.pop();
    if (id === source) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    edges.filter((e) => e.source === id).forEach((e) => stack.push(e.target));
  }
  return false;
}

// Returns a message explaining why a connection is not allowed, or null if it is fine.
export function connectionError({ source, target }, nodes, edges) {
  if (source === target) return "A node can't connect to itself.";
  const s = nodes.find((n) => n.id === source);
  const t = nodes.find((n) => n.id === target);
  if (!s || !t) return 'Unknown node.';
  const from = s.data.category;
  const to = t.data.category;
  if (to === 'Data Source') return 'Sensors are inputs, so nothing can connect into them.';
  if (from === 'Action Trigger') return 'Actions are the end of a flow.';
  if (from === 'Data Source' && to === 'Action Trigger') {
    return 'Add a Threshold between a sensor and an alert.';
  }
  if (edges.some((e) => e.source === source && e.target === target)) {
    return 'These nodes are already connected.';
  }
  if (createsCycle(source, target, edges)) return 'This would create a loop.';
  return null;
}

// Checks every node plus the workflow as a whole.
export function validateWorkflow(nodes, edges, name = '') {
  const byNode = {};
  const add = (id, msg) => { (byNode[id] ||= []).push(msg); };
  const hasIn = (id) => edges.some((e) => e.target === id);
  const hasOut = (id) => edges.some((e) => e.source === id);

  nodes.forEach((n) => {
    const c = n.data.config ?? {};
    switch (n.type) {
      case 'turbineSensor':
      case 'temperatureSensor':
      case 'humiditySensor':
        if (!String(c.sensorId ?? '').trim()) add(n.id, 'Sensor ID is required.');
        if (!hasOut(n.id)) add(n.id, 'Connect this sensor to a filter or threshold.');
        break;
      case 'movingAverage':
        if (!Number.isInteger(c.windowSize) || c.windowSize < 1) add(n.id, 'Window size must be a whole number of 1 or more.');
        if (!hasIn(n.id)) add(n.id, 'Needs an input connection.');
        if (!hasOut(n.id)) add(n.id, 'Needs an output connection.');
        break;
      case 'threshold':
        if (typeof c.threshold !== 'number' || Number.isNaN(c.threshold)) add(n.id, 'Enter a numeric threshold value.');
        if (!hasIn(n.id)) add(n.id, 'Needs an input connection.');
        if (!hasOut(n.id)) add(n.id, 'Connect this to an alert or webhook.');
        break;
      case 'smsAlert':
        if (!/^\+?[0-9]{8,15}$/.test(String(c.recipient ?? '').replace(/[\s-]/g, ''))) add(n.id, 'Enter a valid phone number, e.g. +919876543210.');
        if (!String(c.message ?? '').trim()) add(n.id, 'Message is required.');
        if (!hasIn(n.id)) add(n.id, 'Needs an input connection.');
        break;
      case 'webhook':
        if (!/^https?:\/\/\S+$/i.test(String(c.url ?? '').trim())) add(n.id, 'Enter a valid http(s) URL.');
        if (!hasIn(n.id)) add(n.id, 'Needs an input connection.');
        break;
      default:
        break;
    }
  });

  const workflow = [];
  if (!name.trim()) workflow.push('Give the workflow a name.');
  if (!nodes.some((n) => n.data.category === 'Data Source')) workflow.push('Add at least one sensor.');
  if (!nodes.some((n) => n.data.category === 'Action Trigger')) workflow.push('Add at least one alert or webhook.');

  const total = Object.values(byNode).reduce((sum, list) => sum + list.length, 0) + workflow.length;
  return { byNode, workflow, total };
}