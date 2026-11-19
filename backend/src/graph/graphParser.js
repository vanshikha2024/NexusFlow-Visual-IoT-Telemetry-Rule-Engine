import { ERROR_CODES, NODE_CATEGORIES } from './constants.js';
import { defaultRegistry } from './nodeDefinitions.js';
import { createValidationError } from './errors.js';

/**
 * Modular Parser for saved React Flow Graph JSON.
 *
 * Responsibilities:
 * - Safely deserializes and normalizes React Flow JSON without using eval().
 * - Extracts nodes and edges into indexed lookups and adjacency graphs.
 * - Computes in-degree, out-degree, source nodes, sink nodes.
 * - Performs cycle detection and topological sorting (DAG verification).
 * - Analyzes reachability, isolated orphans, and dead ends.
 */
export class GraphParser {
  /**
   * @param {Object} [options={}]
   * @param {import('./nodeDefinitions.js').NodeRegistry} [options.registry]
   */
  constructor(options = {}) {
    this.registry = options.registry || defaultRegistry;
  }

  /**
   * Parses and normalizes a React Flow JSON graph.
   *
   * @param {string|Object} rawInput - Serialized JSON string or parsed object
   * @returns {{ success: boolean, errors: Array<Object>, graph: Object|null }}
   */
  parse(rawInput) {
    const errors = [];

    // 1. Safe JSON Deserialization (Strictly NO eval)
    let payload = rawInput;
    if (typeof rawInput === 'string') {
      try {
        payload = JSON.parse(rawInput);
      } catch (err) {
        errors.push(
          createValidationError(
            ERROR_CODES.INVALID_JSON,
            'input',
            `Failed to parse workflow JSON: ${err.message}`,
            { originalError: err.message }
          )
        );
        return { success: false, errors, graph: null };
      }
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      errors.push(
        createValidationError(
          ERROR_CODES.INVALID_STRUCTURE,
          'body',
          'Workflow JSON payload must be a non-empty object containing "nodes" and "edges".',
          { receivedType: typeof payload }
        )
      );
      return { success: false, errors, graph: null };
    }

    // Support nested workflow objects or top-level React Flow canvas structures
    const workflowObj = payload.workflow || payload;
    const rawNodes = workflowObj.nodes;
    const rawEdges = workflowObj.edges !== undefined ? workflowObj.edges : [];

    if (!Array.isArray(rawNodes)) {
      errors.push(
        createValidationError(
          ERROR_CODES.INVALID_STRUCTURE,
          'nodes',
          'Workflow "nodes" must be an array.',
          { receivedType: typeof rawNodes }
        )
      );
      return { success: false, errors, graph: null };
    }

    if (!Array.isArray(rawEdges)) {
      errors.push(
        createValidationError(
          ERROR_CODES.INVALID_STRUCTURE,
          'edges',
          'Workflow "edges" must be an array.',
          { receivedType: typeof rawEdges }
        )
      );
      return { success: false, errors, graph: null };
    }

    // 2. Normalize Nodes
    const normalizedNodes = [];
    const nodesById = new Map();
    const duplicateIds = new Set();

    for (let i = 0; i < rawNodes.length; i++) {
      const node = rawNodes[i];
      const prefix = `nodes[${i}]`;

      if (!node || typeof node !== 'object' || Array.isArray(node)) {
        errors.push(
          createValidationError(
            ERROR_CODES.INVALID_STRUCTURE,
            prefix,
            `${prefix} must be a valid JSON object.`,
            { index: i }
          )
        );
        continue;
      }

      const id = typeof node.id === 'string' ? node.id.trim() : '';
      if (!id) {
        errors.push(
          createValidationError(
            ERROR_CODES.INVALID_NODE_ID,
            `${prefix}.id`,
            `${prefix}.id is required and must be a non-empty string.`,
            { index: i }
          )
        );
        continue;
      }

      if (nodesById.has(id)) {
        duplicateIds.add(id);
        errors.push(
          createValidationError(
            ERROR_CODES.DUPLICATE_NODE_ID,
            `${prefix}.id`,
            `Duplicate node ID "${id}" detected at ${prefix}. Node IDs must be unique within the workflow graph.`,
            { duplicateId: id, index: i }
          )
        );
        continue;
      }

      const type = typeof node.type === 'string' ? node.type.trim() : '';
      const category =
        this.registry.getCategory(type) ||
        (node.data?.category && typeof node.data.category === 'string'
          ? node.data.category
          : null);

      // Extract config safely: merge node.config, node.data.config, and key data fields
      const nodeConfig = {
        ...(node.data?.config && typeof node.data.config === 'object'
          ? node.data.config
          : {}),
        ...(node.config && typeof node.config === 'object' ? node.config : {}),
      };

      // In custom React Flow nodes, form controls often bind directly to node.data
      const standardKeys = [
        'sensorId',
        'metric',
        'unit',
        'operator',
        'threshold',
        'windowSize',
        'recipient',
        'phone',
        'url',
        'method',
        'topic',
        'operation',
        'formula',
        'expression',
        'predicate',
        'factor',
        'offset',
        'value',
        'window',
      ];
      if (node.data && typeof node.data === 'object') {
        for (const k of standardKeys) {
          if (node.data[k] !== undefined && nodeConfig[k] === undefined) {
            nodeConfig[k] = node.data[k];
          }
        }
      }

      const normalizedNode = {
        id,
        type,
        category,
        label:
          typeof node.label === 'string'
            ? node.label
            : typeof node.data?.label === 'string'
              ? node.data.label
              : id,
        position: {
          x: typeof node.position?.x === 'number' && !isNaN(node.position.x) ? node.position.x : 0,
          y: typeof node.position?.y === 'number' && !isNaN(node.position.y) ? node.position.y : 0,
        },
        config: nodeConfig,
        data: node.data && typeof node.data === 'object' && !Array.isArray(node.data) ? node.data : {},
        index: i,
        raw: node,
      };

      normalizedNodes.push(normalizedNode);
      nodesById.set(id, normalizedNode);
    }

    // 3. Normalize Edges
    const normalizedEdges = [];
    const edgesById = new Map();
    const seenEdges = new Set();

    for (let i = 0; i < rawEdges.length; i++) {
      const edge = rawEdges[i];
      const prefix = `edges[${i}]`;

      if (!edge || typeof edge !== 'object' || Array.isArray(edge)) {
        errors.push(
          createValidationError(
            ERROR_CODES.INVALID_STRUCTURE,
            prefix,
            `${prefix} must be a valid JSON object.`,
            { index: i }
          )
        );
        continue;
      }

      const source = typeof edge.source === 'string' ? edge.source.trim() : '';
      const target = typeof edge.target === 'string' ? edge.target.trim() : '';
      const edgeId =
        typeof edge.id === 'string' && edge.id.trim() !== ''
          ? edge.id.trim()
          : `edge_${source || 'src'}_${target || 'tgt'}_${i}`;

      const edgeSignature = `${source}->${target}:${edge.sourceHandle || ''}:${edge.targetHandle || ''}`;
      const isDuplicateEdge = seenEdges.has(edgeSignature);
      seenEdges.add(edgeSignature);

      const normalizedEdge = {
        id: edgeId,
        source,
        target,
        sourceHandle:
          edge.sourceHandle !== undefined && edge.sourceHandle !== null
            ? String(edge.sourceHandle)
            : null,
        targetHandle:
          edge.targetHandle !== undefined && edge.targetHandle !== null
            ? String(edge.targetHandle)
            : null,
        animated: Boolean(edge.animated),
        style: edge.style && typeof edge.style === 'object' ? edge.style : {},
        index: i,
        isDuplicate: isDuplicateEdge,
        raw: edge,
      };

      normalizedEdges.push(normalizedEdge);
      edgesById.set(edgeId, normalizedEdge);
    }

    // 4. Construct Adjacency & Degree Lookups
    const adjacency = new Map(); // sourceId -> array of targetIds
    const reverseAdjacency = new Map(); // targetId -> array of sourceIds
    const outgoingEdges = new Map(); // sourceId -> array of normalizedEdge
    const incomingEdges = new Map(); // targetId -> array of normalizedEdge
    const inDegree = new Map();
    const outDegree = new Map();

    for (const node of normalizedNodes) {
      adjacency.set(node.id, []);
      reverseAdjacency.set(node.id, []);
      outgoingEdges.set(node.id, []);
      incomingEdges.set(node.id, []);
      inDegree.set(node.id, 0);
      outDegree.set(node.id, 0);
    }

    for (const edge of normalizedEdges) {
      if (edge.source && nodesById.has(edge.source) && edge.target && nodesById.has(edge.target)) {
        // Prevent duplicate increments for exact duplicate edges
        if (!edge.isDuplicate && edge.source !== edge.target) {
          adjacency.get(edge.source).push(edge.target);
          reverseAdjacency.get(edge.target).push(edge.source);
          inDegree.set(edge.target, inDegree.get(edge.target) + 1);
          outDegree.set(edge.source, outDegree.get(edge.source) + 1);
        }
        outgoingEdges.get(edge.source).push(edge);
        incomingEdges.get(edge.target).push(edge);
      }
    }

    // 5. Categorized Node Subsets
    const sources = normalizedNodes.filter(
      (n) => n.category === NODE_CATEGORIES.DATA_SOURCE || inDegree.get(n.id) === 0
    );
    const sinks = normalizedNodes.filter(
      (n) => n.category === NODE_CATEGORIES.ACTION_TRIGGER || outDegree.get(n.id) === 0
    );

    // 6. Cycle Detection (DFS 3-color marking with exact cycle path tracking)
    // 0 = UNVISITED, 1 = VISITING (on current DFS call stack), 2 = VISITED
    const visitState = new Map();
    for (const node of normalizedNodes) {
      visitState.set(node.id, 0);
    }

    const detectedCycles = [];
    const pathStack = [];

    const dfsCycle = (nodeId) => {
      visitState.set(nodeId, 1);
      pathStack.push(nodeId);

      const neighbors = adjacency.get(nodeId) || [];
      for (const neighborId of neighbors) {
        const state = visitState.get(neighborId);
        if (state === 1) {
          // Cycle found! Extract the cycle slice from pathStack
          const cycleStartIndex = pathStack.indexOf(neighborId);
          if (cycleStartIndex !== -1) {
            const cyclePath = pathStack.slice(cycleStartIndex).concat(neighborId);
            detectedCycles.push(cyclePath);
          }
        } else if (state === 0) {
          dfsCycle(neighborId);
        }
      }

      pathStack.pop();
      visitState.set(nodeId, 2);
    };

    for (const node of normalizedNodes) {
      if (visitState.get(node.id) === 0) {
        dfsCycle(node.id);
      }
    }

    // 7. Topological Sort (Kahn's algorithm)
    let topologicalOrder = null;
    const isAcyclic = detectedCycles.length === 0;

    if (isAcyclic && normalizedNodes.length > 0) {
      const currentInDegree = new Map(inDegree);
      const queue = [];

      for (const node of normalizedNodes) {
        if (currentInDegree.get(node.id) === 0) {
          queue.push(node.id);
        }
      }

      const order = [];
      while (queue.length > 0) {
        const currId = queue.shift();
        order.push(currId);

        const neighbors = adjacency.get(currId) || [];
        for (const neighborId of neighbors) {
          const updatedDeg = currentInDegree.get(neighborId) - 1;
          currentInDegree.set(neighborId, updatedDeg);
          if (updatedDeg === 0) {
            queue.push(neighborId);
          }
        }
      }

      if (order.length === normalizedNodes.length) {
        topologicalOrder = order;
      }
    }

    // 8. Reachability Analysis (BFS from all data sources)
    const reachableFromSources = new Set();
    const sourceQueue = [];

    for (const node of normalizedNodes) {
      if (node.category === NODE_CATEGORIES.DATA_SOURCE) {
        reachableFromSources.add(node.id);
        sourceQueue.push(node.id);
      }
    }

    while (sourceQueue.length > 0) {
      const curr = sourceQueue.shift();
      const neighbors = adjacency.get(curr) || [];
      for (const next of neighbors) {
        if (!reachableFromSources.has(next)) {
          reachableFromSources.add(next);
          sourceQueue.push(next);
        }
      }
    }

    const unreachableNodes = normalizedNodes.filter(
      (n) => n.category !== NODE_CATEGORIES.DATA_SOURCE && !reachableFromSources.has(n.id)
    );

    const orphanNodes = normalizedNodes.filter(
      (n) => inDegree.get(n.id) === 0 && outDegree.get(n.id) === 0
    );

    const deadEndNodes = normalizedNodes.filter(
      (n) =>
        n.category === NODE_CATEGORIES.MATH_OPERATION &&
        inDegree.get(n.id) > 0 &&
        outDegree.get(n.id) === 0
    );

    const parsedGraph = {
      nodes: normalizedNodes,
      edges: normalizedEdges,
      nodesById,
      edgesById,
      adjacency,
      reverseAdjacency,
      outgoingEdges,
      incomingEdges,
      inDegree,
      outDegree,
      sources,
      sinks,
      cycles: detectedCycles,
      isAcyclic,
      topologicalOrder,
      reachability: {
        reachableFromSources,
        unreachableNodes,
        orphanNodes,
        deadEndNodes,
      },
      metadata: {
        totalNodes: normalizedNodes.length,
        totalEdges: normalizedEdges.length,
        sourceCount: sources.length,
        sinkCount: sinks.length,
        hasDuplicates: duplicateIds.size > 0,
      },
    };

    return {
      success: errors.length === 0,
      errors,
      graph: parsedGraph,
    };
  }
}

export const defaultParser = new GraphParser();
export const parseGraph = (rawInput, options) => {
  const parser = options?.registry ? new GraphParser(options) : defaultParser;
  return parser.parse(rawInput);
};
