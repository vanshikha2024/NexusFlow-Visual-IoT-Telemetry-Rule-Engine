import {
  ERROR_CODES,
  NODE_CATEGORIES,
  DISCONNECTED_NODE_STRATEGY,
} from './constants.js';
import { defaultRegistry } from './nodeDefinitions.js';
import { defaultParser, GraphParser } from './graphParser.js';
import { defaultValidator, GraphValidator } from './graphValidator.js';
import { defaultHandlerRegistry, ExecutionHandlerRegistry } from './executionHandlers.js';
import { createValidationError } from './errors.js';

/**
 * Graph Dependency Resolver (Day 8)
 *
 * Responsibilities:
 * - Converts validated React Flow nodes and edges into clean adjacency-list representations.
 * - Determines execution order using Kahn's topological sort and assigns execution stages (layers).
 * - Detects dependency cycles and outputs exact cycle paths.
 * - Handles disconnected and unreachable nodes according to configurable strategies (PRUNE / REJECT / WARN).
 * - Resolves upstream dependencies and downstream dependents for sources, operations, and actions.
 * - Maps every active node to its corresponding backend execution handler descriptor.
 * - Traces end-to-end dataflow pipelines (Source -> Transforms -> Action Sinks).
 * - Prepares a structured Execution Plan for Day 9's RxJS stream compiler.
 */
export class GraphDependencyResolver {
  /**
   * @param {Object} [options={}]
   * @param {ExecutionHandlerRegistry} [options.handlerRegistry]
   * @param {GraphValidator} [options.validator]
   * @param {GraphParser} [options.parser]
   * @param {import('./nodeDefinitions.js').NodeRegistry} [options.nodeRegistry]
   * @param {string} [options.defaultStrategy]
   */
  constructor(options = {}) {
    this.nodeRegistry = options.nodeRegistry || defaultRegistry;
    this.handlerRegistry = options.handlerRegistry || defaultHandlerRegistry;
    this.parser =
      options.parser ||
      (options.nodeRegistry ? new GraphParser({ registry: this.nodeRegistry }) : defaultParser);
    this.validator =
      options.validator ||
      (options.nodeRegistry ? new GraphValidator({ registry: this.nodeRegistry }) : defaultValidator);
    this.defaultStrategy =
      options.defaultStrategy || DISCONNECTED_NODE_STRATEGY.PRUNE;
  }

  /**
   * Resolves graph dependencies and generates an execution plan.
   *
   * @param {string|Object} rawInput - React Flow JSON string, canvas object, or workflow document
   * @param {Object} [resolveOptions={}]
   * @param {'PRUNE'|'REJECT'|'WARN'} [resolveOptions.strategy='PRUNE'] - Disconnected node handling rule
   * @param {boolean} [resolveOptions.validateFirst=true] - Run validation before dependency resolution
   * @param {string} [resolveOptions.workflowId] - Optional workflow identifier
   * @param {string} [resolveOptions.workflowName] - Optional workflow title
   * @returns {{
   *   success: boolean,
   *   plan: Object|null,
   *   errors: Array<Object>,
   *   warnings: Array<Object>
   * }}
   */
  resolve(rawInput, resolveOptions = {}) {
    const opts = {
      strategy: resolveOptions?.strategy || this.defaultStrategy,
      validateFirst:
        resolveOptions?.validateFirst !== undefined ? resolveOptions.validateFirst : true,
      workflowId: resolveOptions?.workflowId || null,
      workflowName: resolveOptions?.workflowName || null,
    };

    const errors = [];
    const warnings = [];

    // 1. Initial Parsing
    let parsedResult;
    if (rawInput && rawInput.nodesById instanceof Map && Array.isArray(rawInput.nodes)) {
      parsedResult = { success: true, errors: [], graph: rawInput };
    } else {
      parsedResult = this.parser.parse(rawInput);
    }

    if (!parsedResult.success || !parsedResult.graph) {
      return {
        success: false,
        plan: null,
        errors: parsedResult.errors || [],
        warnings,
      };
    }

    const { graph } = parsedResult;
    const rawWorkflow = typeof rawInput === 'object' && rawInput !== null ? rawInput : {};
    const workflowId =
      opts.workflowId || rawWorkflow.id || rawWorkflow._id || graph.metadata?.workflowId || null;
    const workflowName =
      opts.workflowName || rawWorkflow.name || graph.metadata?.workflowName || 'Workflow';

    // 2. Structural & Semantic Validation (when enabled)
    if (opts.validateFirst) {
      // If not strictly rejecting, tell validator not to fail solely on disconnected nodes
      const allowDisconnected = opts.strategy !== DISCONNECTED_NODE_STRATEGY.REJECT;
      const validatorOpts = {
        allowDisconnectedNodes: allowDisconnected,
        allowUnreachableNodes: allowDisconnected,
        allowDeadEnds: allowDisconnected,
      };

      const validation = this.validator.validate(graph, validatorOpts);
      if (!validation.isValid) {
        return {
          success: false,
          plan: null,
          errors: validation.errors,
          warnings: validation.warnings,
        };
      }
    }

    // 3. Cycle Detection on submitted graph
    if (!graph.isAcyclic || (graph.cycles && graph.cycles.length > 0)) {
      for (const cycle of graph.cycles) {
        errors.push(
          createValidationError(
            ERROR_CODES.DEPENDENCY_CYCLE_DETECTED,
            'edges',
            `Dependency cycle detected: ${cycle.join(' -> ')}. Cannot resolve execution dependencies for cyclic graph.`,
            { cycle }
          )
        );
      }
      return {
        success: false,
        plan: null,
        errors,
        warnings,
      };
    }

    // 4. Build Initial Adjacency Lists and Degree Lookups
    const allNodesById = graph.nodesById;
    const initialAdjacency = new Map(); // sourceId -> Array<{ targetId, edgeId, sourceHandle, targetHandle }>
    const initialReverseAdjacency = new Map(); // targetId -> Array<{ sourceId, edgeId, sourceHandle, targetHandle }>
    const initialInDegree = new Map();
    const initialOutDegree = new Map();

    for (const node of graph.nodes) {
      initialAdjacency.set(node.id, []);
      initialReverseAdjacency.set(node.id, []);
      initialInDegree.set(node.id, 0);
      initialOutDegree.set(node.id, 0);
    }

    for (const edge of graph.edges) {
      if (
        edge.source &&
        allNodesById.has(edge.source) &&
        edge.target &&
        allNodesById.has(edge.target) &&
        edge.source !== edge.target &&
        !edge.isDuplicate
      ) {
        const edgeDescriptor = {
          edgeId: edge.id,
          sourceHandle: edge.sourceHandle || null,
          targetHandle: edge.targetHandle || null,
          animated: edge.animated || false,
        };

        initialAdjacency.get(edge.source).push({
          targetId: edge.target,
          ...edgeDescriptor,
        });

        initialReverseAdjacency.get(edge.target).push({
          sourceId: edge.source,
          ...edgeDescriptor,
        });

        initialInDegree.set(edge.target, initialInDegree.get(edge.target) + 1);
        initialOutDegree.set(edge.source, initialOutDegree.get(edge.source) + 1);
      }
    }

    // 5. Handle Disconnected and Unreachable Nodes
    const prunedNodes = [];
    const activeNodeIds = new Set();

    // Identify isolated nodes (inDegree 0 and outDegree 0)
    const isolatedNodeIds = new Set();
    for (const node of graph.nodes) {
      if (initialInDegree.get(node.id) === 0 && initialOutDegree.get(node.id) === 0) {
        isolatedNodeIds.add(node.id);
      }
    }

    // Identify unreachable nodes from any dataSource
    const reachableFromSources = new Set();
    const sourceQueue = [];

    for (const node of graph.nodes) {
      if (node.category === NODE_CATEGORIES.DATA_SOURCE && !isolatedNodeIds.has(node.id)) {
        reachableFromSources.add(node.id);
        sourceQueue.push(node.id);
      }
    }

    while (sourceQueue.length > 0) {
      const curr = sourceQueue.shift();
      const outgoing = initialAdjacency.get(curr) || [];
      for (const { targetId } of outgoing) {
        if (!reachableFromSources.has(targetId)) {
          reachableFromSources.add(targetId);
          sourceQueue.push(targetId);
        }
      }
    }

    for (const node of graph.nodes) {
      const isIsolated = isolatedNodeIds.has(node.id);
      const isUnreachable =
        node.category !== NODE_CATEGORIES.DATA_SOURCE && !reachableFromSources.has(node.id);

      if (isIsolated || isUnreachable) {
        if (opts.strategy === DISCONNECTED_NODE_STRATEGY.REJECT) {
          const code = isIsolated
            ? ERROR_CODES.DISCONNECTED_NODES_REJECTED
            : ERROR_CODES.UNREACHABLE_NODE;
          const msg = isIsolated
            ? `Disconnected node "${node.id}" (${node.type}) is rejected by execution policy.`
            : `Node "${node.id}" (${node.type}) is unreachable from any data source and rejected by execution policy.`;
          errors.push(
            createValidationError(code, `nodes[${node.index}]`, msg, {
              nodeId: node.id,
              type: node.type,
              reason: isIsolated ? 'ISOLATED_NODE' : 'UNREACHABLE_FROM_SOURCE',
            })
          );
        } else {
          // PRUNE or WARN
          prunedNodes.push({
            id: node.id,
            type: node.type,
            category: node.category,
            label: node.label,
            reason: isIsolated ? 'ISOLATED_NODE' : 'UNREACHABLE_FROM_SOURCE',
            message: isIsolated
              ? `Node "${node.id}" has no connections and was pruned from execution plan.`
              : `Node "${node.id}" cannot be reached from any data source and was pruned.`,
          });
          if (opts.strategy === DISCONNECTED_NODE_STRATEGY.WARN) {
            warnings.push({
              code: isIsolated
                ? ERROR_CODES.DISCONNECTED_NODE
                : ERROR_CODES.UNREACHABLE_NODE,
              field: `nodes[${node.index}]`,
              message: isIsolated
                ? `Disconnected node "${node.id}" will not execute in telemetry stream.`
                : `Node "${node.id}" is unreachable from data sources and will not receive events.`,
            });
          }
        }
      } else {
        activeNodeIds.add(node.id);
      }
    }

    if (errors.length > 0) {
      return {
        success: false,
        plan: null,
        errors,
        warnings,
      };
    }

    // 6. Check for Active Executable Nodes
    if (activeNodeIds.size === 0) {
      errors.push(
        createValidationError(
          ERROR_CODES.NO_EXECUTABLE_PIPELINES,
          'nodes',
          'No connected, executable nodes remain after dependency resolution.',
          { submittedNodes: graph.nodes.length, prunedCount: prunedNodes.length }
        )
      );
      return {
        success: false,
        plan: null,
        errors,
        warnings,
      };
    }

    // 7. Build Active Subgraph Adjacency Lists & In/Out Degrees
    const activeAdjacency = new Map();
    const activeReverseAdjacency = new Map();
    const activeInDegree = new Map();
    const activeOutDegree = new Map();

    for (const id of activeNodeIds) {
      activeAdjacency.set(id, []);
      activeReverseAdjacency.set(id, []);
      activeInDegree.set(id, 0);
      activeOutDegree.set(id, 0);
    }

    for (const sourceId of activeNodeIds) {
      const outgoing = initialAdjacency.get(sourceId) || [];
      for (const edge of outgoing) {
        if (activeNodeIds.has(edge.targetId)) {
          activeAdjacency.get(sourceId).push(edge);
          activeReverseAdjacency.get(edge.targetId).push({
            sourceId,
            edgeId: edge.edgeId,
            sourceHandle: edge.sourceHandle,
            targetHandle: edge.targetHandle,
            animated: edge.animated,
          });
          activeInDegree.set(edge.targetId, activeInDegree.get(edge.targetId) + 1);
          activeOutDegree.set(sourceId, activeOutDegree.get(sourceId) + 1);
        }
      }
    }

    // 8. Topological Sort on Active Nodes (Kahn's Algorithm)
    const topologicalOrder = [];
    const kahnQueue = [];
    const remainingInDegree = new Map(activeInDegree);

    for (const id of activeNodeIds) {
      if (remainingInDegree.get(id) === 0) {
        kahnQueue.push(id);
      }
    }

    while (kahnQueue.length > 0) {
      const currId = kahnQueue.shift();
      topologicalOrder.push(currId);

      const neighbors = activeAdjacency.get(currId) || [];
      for (const { targetId } of neighbors) {
        const updated = remainingInDegree.get(targetId) - 1;
        remainingInDegree.set(targetId, updated);
        if (updated === 0) {
          kahnQueue.push(targetId);
        }
      }
    }

    if (topologicalOrder.length !== activeNodeIds.size) {
      errors.push(
        createValidationError(
          ERROR_CODES.DEPENDENCY_CYCLE_DETECTED,
          'edges',
          'Unresolvable dependency cycle detected among active nodes.',
          { resolvedCount: topologicalOrder.length, activeCount: activeNodeIds.size }
        )
      );
      return {
        success: false,
        plan: null,
        errors,
        warnings,
      };
    }

    // 9. Compute Execution Stages (Layers for Parallel Stream Compilation)
    // Stage 0: Root sources (inDegree === 0)
    // Stage k: 1 + max(stage of upstream dependencies)
    const nodeStageMap = new Map();
    for (const id of topologicalOrder) {
      const incoming = activeReverseAdjacency.get(id) || [];
      if (incoming.length === 0) {
        nodeStageMap.set(id, 0);
      } else {
        let maxUpstream = 0;
        for (const { sourceId } of incoming) {
          const upStage = nodeStageMap.get(sourceId) || 0;
          if (upStage > maxUpstream) {
            maxUpstream = upStage;
          }
        }
        nodeStageMap.set(id, maxUpstream + 1);
      }
    }

    // 10. Resolve Node Execution Handlers and Dependency Relationships
    const resolvedNodes = new Map();

    for (const id of topologicalOrder) {
      const node = allNodesById.get(id);
      const handlerDescriptor = this.handlerRegistry.getHandlerForNode(node);

      if (!handlerDescriptor) {
        errors.push(
          createValidationError(
            ERROR_CODES.MISSING_HANDLER,
            `nodes.${id}`,
            `No backend execution handler found for node "${id}" of type "${node.type}".`,
            { nodeId: id, type: node.type, category: node.category }
          )
        );
        continue;
      }

      // Map upstream dependencies
      const incoming = activeReverseAdjacency.get(id) || [];
      const upstream = incoming.map((edge) => {
        const sourceNode = allNodesById.get(edge.sourceId);
        return {
          sourceId: edge.sourceId,
          sourceType: sourceNode?.type || 'unknown',
          sourceCategory: sourceNode?.category || null,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle,
          edgeId: edge.edgeId,
        };
      });

      // Map downstream dependents
      const outgoing = activeAdjacency.get(id) || [];
      const downstream = outgoing.map((edge) => {
        const targetNode = allNodesById.get(edge.targetId);
        return {
          targetId: edge.targetId,
          targetType: targetNode?.type || 'unknown',
          targetCategory: targetNode?.category || null,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle,
          edgeId: edge.edgeId,
        };
      });

      const stageIndex = nodeStageMap.get(id);

      resolvedNodes.set(id, {
        id: node.id,
        type: node.type,
        category: node.category,
        label: node.label,
        position: node.position,
        config: node.config,
        data: node.data,
        handler: handlerDescriptor,
        executionStage: stageIndex,
        isSource: node.category === NODE_CATEGORIES.DATA_SOURCE,
        isIntermediate: node.category === NODE_CATEGORIES.MATH_OPERATION,
        isSink: node.category === NODE_CATEGORIES.ACTION_TRIGGER,
        upstream,
        downstream,
      });
    }

    if (errors.length > 0) {
      return {
        success: false,
        plan: null,
        errors,
        warnings,
      };
    }

    // 11. Group Execution Stages
    const maxStage = Math.max(...Array.from(nodeStageMap.values()), 0);
    const executionStages = [];
    for (let s = 0; s <= maxStage; s++) {
      const stageNodeIds = topologicalOrder.filter((id) => nodeStageMap.get(id) === s);
      if (stageNodeIds.length > 0) {
        executionStages.push({
          stageIndex: s,
          nodeIds: stageNodeIds,
          nodes: stageNodeIds.map((id) => resolvedNodes.get(id)),
        });
      }
    }

    // 12. Trace End-to-End Dataflow Pipelines (Source -> Transforms -> Action Sinks)
    const sources = topologicalOrder
      .map((id) => resolvedNodes.get(id))
      .filter((n) => n.isSource);

    const sinks = topologicalOrder
      .map((id) => resolvedNodes.get(id))
      .filter((n) => n.isSink);

    const pipelines = [];

    const tracePaths = (currId, currentPath, currentStages) => {
      const currNode = resolvedNodes.get(currId);
      const nextPath = currentPath.concat(currId);
      const nextStages = currentStages.concat(currNode.executionStage);

      if (currNode.isSink) {
        pipelines.push({
          id: `pipe_${nextPath[0]}_to_${currId}_${pipelines.length}`,
          sourceId: nextPath[0],
          sinkId: currId,
          path: nextPath,
          stages: nextStages,
        });
        return;
      }

      const outgoing = activeAdjacency.get(currId) || [];
      for (const { targetId } of outgoing) {
        tracePaths(targetId, nextPath, nextStages);
      }
    };

    for (const src of sources) {
      tracePaths(src.id, [], []);
    }

    // 13. Assemble Final Execution Plan
    const executionPlan = {
      workflowId,
      workflowName,
      topologicalOrder,
      executionStages,
      nodes: Array.from(resolvedNodes.values()),
      nodesById: resolvedNodes,
      sources,
      sinks,
      pipelines,
      prunedNodes,
      adjacency: activeAdjacency,
      reverseAdjacency: activeReverseAdjacency,
      inDegree: activeInDegree,
      outDegree: activeOutDegree,
      metadata: {
        totalSubmittedNodes: graph.nodes.length,
        activeNodesCount: activeNodeIds.size,
        prunedNodesCount: prunedNodes.length,
        sourceCount: sources.length,
        sinkCount: sinks.length,
        pipelineCount: pipelines.length,
        stageCount: executionStages.length,
        isAcyclic: true,
        strategy: opts.strategy,
      },
    };

    return {
      success: true,
      plan: executionPlan,
      errors: [],
      warnings,
    };
  }
}

export const defaultResolver = new GraphDependencyResolver();
export const resolveGraphDependencies = (rawInput, options) => {
  const resolver =
    options?.handlerRegistry || options?.nodeRegistry
      ? new GraphDependencyResolver(options)
      : defaultResolver;
  return resolver.resolve(rawInput, options);
};
