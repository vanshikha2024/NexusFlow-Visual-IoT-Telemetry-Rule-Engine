import { NODE_LIBRARY } from '../nodeTypes';

// Turns a workflow saved on the backend back into React Flow nodes and edges.
export function toFlow(workflow) {
  const skipped = [];
  const nodes = [];
  (workflow.nodes ?? []).forEach((n) => {
    const lib = NODE_LIBRARY.find((l) => l.type === n.type);
    if (!lib) { skipped.push(n.label || n.type); return; }
    nodes.push({
      id: n.id,
      type: n.type,
      position: n.position ?? { x: 0, y: 0 },
      data: { ...lib, config: { ...lib.config, ...(n.config ?? {}) } },
    });
  });
  const ids = new Set(nodes.map((n) => n.id));
  const edges = (workflow.edges ?? [])
    .filter((e) => ids.has(e.source) && ids.has(e.target))
    .map((e, i) => ({
      id: e.id ?? `edge-${e.source}-${e.target}-${i}`,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? 'output',
      targetHandle: e.targetHandle ?? 'input',
      animated: true,
    }));
  return { nodes, edges, skipped };
}

// Highest numeric suffix of node ids like "node-7", so new nodes never reuse an id.
export function maxNodeNumber(nodes) {
  return nodes.reduce((max, n) => {
    const m = /(\d+)$/.exec(n.id);
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
}