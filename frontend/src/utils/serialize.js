// Builds the workflow payload exactly as the backend (Member 2) expects.
export function serializeGraph(nodes, edges, name = 'Untitled Workflow', description = '') {
  return {
    name,
    description,
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type,
      label: n.data.label,
      position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
      config: n.data.config ?? {},
    })),
    edges: edges.map((e) => ({
      id: `edge-${e.source}-${e.target}`,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? 'output',
      targetHandle: e.targetHandle ?? 'input',
    })),
  };
}