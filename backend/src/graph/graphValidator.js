import { ERROR_CODES, NODE_CATEGORIES } from './constants.js';
import { defaultRegistry } from './nodeDefinitions.js';
import { defaultParser, GraphParser } from './graphParser.js';
import { createValidationError } from './errors.js';

/**
 * Modular Graph Validator for NexusFlow Visual Workflows.
 *
 * Enforces:
 * - JSON and graph structure validity
 * - Unique node IDs
 * - Supported node types
 * - Required node configuration
 * - Edge source and target integrity (dangling edges)
 * - Self-loop and duplicate edge prevention
 * - Unsupported connection prevention (category dataflow rules)
 * - Cycle detection for acyclic execution graphs (DAG requirement)
 * - Source and sink node completeness
 * - Orphan, unreachable, and dead-end node detection
 */
export class GraphValidator {
  /**
   * @param {Object} [options={}]
   * @param {import('./nodeDefinitions.js').NodeRegistry} [options.registry]
   * @param {GraphParser} [options.parser]
   */
  constructor(options = {}) {
    this.registry = options.registry || defaultRegistry;
    this.parser = options.parser || (options.registry ? new GraphParser({ registry: this.registry }) : defaultParser);
  }

  /**
   * Validates a workflow graph.
   *
   * @param {string|Object} rawInput - React Flow JSON string, parsed object, or parsed graph structure
   * @param {Object} [validationOptions={}]
   * @param {boolean} [validationOptions.requireAcyclic=true] - Require DAG (no cycles)
   * @param {boolean} [validationOptions.requireSourceNode=true] - Require at least one data source
   * @param {boolean} [validationOptions.requireSinkNode=true] - Require at least one action trigger sink
   * @param {boolean} [validationOptions.allowDisconnectedNodes=false] - Flag isolated nodes as errors
   * @param {boolean} [validationOptions.allowUnreachableNodes=false] - Flag nodes unreachable from sources
   * @param {boolean} [validationOptions.allowDeadEnds=false] - Flag intermediate nodes with outDegree 0
   * @param {boolean} [validationOptions.enforceCategoryConnections=true] - Enforce source->math->action rules
   * @param {boolean} [validationOptions.enforceSupportedTypes=true] - Enforce node type registry
   * @param {boolean} [validationOptions.enforceNodeConfigs=true] - Enforce required config parameters
   * @returns {{
   *   isValid: boolean,
   *   errors: Array<Object>,
   *   warnings: Array<Object>,
   *   summary: Object|null,
   *   graph: Object|null
   * }}
   */
  validate(rawInput, validationOptions = {}) {
    const opts = {
      requireAcyclic: true,
      requireSourceNode: true,
      requireSinkNode: true,
      allowDisconnectedNodes: false,
      allowUnreachableNodes: false,
      allowDeadEnds: false,
      enforceCategoryConnections: true,
      enforceSupportedTypes: true,
      enforceNodeConfigs: true,
      ...validationOptions,
    };

    const errors = [];
    const warnings = [];

    // 1. Parse Graph (or reuse already-parsed graph structure)
    let parsedResult;
    if (rawInput && rawInput.nodesById instanceof Map && Array.isArray(rawInput.nodes)) {
      // Input is already an AST from GraphParser
      parsedResult = { success: true, errors: [], graph: rawInput };
    } else {
      parsedResult = this.parser.parse(rawInput);
    }

    if (!parsedResult.success || !parsedResult.graph) {
      errors.push(...parsedResult.errors);
      return {
        isValid: false,
        errors,
        warnings,
        summary: null,
        graph: null,
      };
    }

    // Include any duplicate ID or structural errors captured during parsing
    if (parsedResult.errors.length > 0) {
      errors.push(...parsedResult.errors);
    }

    const { graph } = parsedResult;

    // 2. Validate Empty Graph
    if (graph.nodes.length === 0) {
      errors.push(
        createValidationError(
          ERROR_CODES.EMPTY_GRAPH,
          'nodes',
          'Workflow graph must contain at least one node.',
          { nodeCount: 0 }
        )
      );
      return {
        isValid: false,
        errors,
        warnings,
        summary: null,
        graph,
      };
    }

    // 3. Validate Node Types & Configurations
    for (let i = 0; i < graph.nodes.length; i++) {
      const node = graph.nodes[i];
      const prefix = `nodes[${node.index}]`;

      // 3.1 Validate Supported Node Type
      if (opts.enforceSupportedTypes) {
        if (!node.type || typeof node.type !== 'string' || node.type.trim() === '') {
          errors.push(
            createValidationError(
              ERROR_CODES.UNSUPPORTED_NODE_TYPE,
              `${prefix}.type`,
              `${prefix}.type is required and must be a non-empty string.`,
              { nodeId: node.id }
            )
          );
          continue;
        }

        if (!this.registry.isSupported(node.type)) {
          errors.push(
            createValidationError(
              ERROR_CODES.UNSUPPORTED_NODE_TYPE,
              `${prefix}.type`,
              `Unsupported node type "${node.type}" at ${prefix} (ID: "${node.id}"). Supported types: ${this.registry.getAllSupportedTypes().join(', ')}.`,
              {
                nodeId: node.id,
                type: node.type,
                supportedTypes: this.registry.getAllSupportedTypes(),
              }
            )
          );
          continue;
        }
      }

      // 3.2 Validate Required Node Configuration
      if (opts.enforceNodeConfigs && this.registry.isSupported(node.type)) {
        const def = this.registry.getDefinition(node.type);
        if (def && typeof def.validateConfig === 'function') {
          const configErrors = def.validateConfig(node.config, node);
          for (const msg of configErrors) {
            errors.push(
              createValidationError(
                ERROR_CODES.INVALID_NODE_CONFIG,
                `${prefix}.config`,
                msg,
                { nodeId: node.id, type: node.type, config: node.config }
              )
            );
          }
        }
      }
    }

    // 4. Validate Edge References, Loops, & Unsupported Connections
    for (let i = 0; i < graph.edges.length; i++) {
      const edge = graph.edges[i];
      const prefix = `edges[${edge.index}]`;

      // 4.1 Missing or Empty Source / Target
      if (!edge.source || edge.source.trim() === '') {
        errors.push(
          createValidationError(
            ERROR_CODES.INVALID_EDGE_REFERENCE,
            `${prefix}.source`,
            `${prefix}.source is required and must be a non-empty string.`,
            { edgeIndex: edge.index, edgeId: edge.id }
          )
        );
      }

      if (!edge.target || edge.target.trim() === '') {
        errors.push(
          createValidationError(
            ERROR_CODES.INVALID_EDGE_REFERENCE,
            `${prefix}.target`,
            `${prefix}.target is required and must be a non-empty string.`,
            { edgeIndex: edge.index, edgeId: edge.id }
          )
        );
      }

      const sourceExists = graph.nodesById.has(edge.source);
      const targetExists = graph.nodesById.has(edge.target);

      // 4.2 Dangling Edge Detection
      if (edge.source && !sourceExists) {
        errors.push(
          createValidationError(
            ERROR_CODES.INVALID_EDGE_REFERENCE,
            `${prefix}.source`,
            `Dangling edge at ${prefix}: source node "${edge.source}" does not exist in nodes list.`,
            { edgeIndex: edge.index, edgeId: edge.id, missingSource: edge.source }
          )
        );
      }

      if (edge.target && !targetExists) {
        errors.push(
          createValidationError(
            ERROR_CODES.INVALID_EDGE_REFERENCE,
            `${prefix}.target`,
            `Dangling edge at ${prefix}: target node "${edge.target}" does not exist in nodes list.`,
            { edgeIndex: edge.index, edgeId: edge.id, missingTarget: edge.target }
          )
        );
      }

      // 4.3 Self-Connecting Loop Detection
      if (edge.source && edge.target && edge.source === edge.target) {
        errors.push(
          createValidationError(
            ERROR_CODES.SELF_LOOP,
            prefix,
            `Invalid self-connecting loop at ${prefix}: node "${edge.source}" connects to itself.`,
            { edgeIndex: edge.index, edgeId: edge.id, nodeId: edge.source }
          )
        );
      }

      // 4.4 Duplicate Edge Detection
      if (edge.isDuplicate) {
        warnings.push(
          createValidationError(
            ERROR_CODES.DUPLICATE_EDGE,
            prefix,
            `Duplicate edge at ${prefix}: redundant connection between "${edge.source}" and "${edge.target}".`,
            { edgeIndex: edge.index, edgeId: edge.id, source: edge.source, target: edge.target }
          )
        );
      }

      // 4.5 Category Connection Rules
      if (opts.enforceCategoryConnections && sourceExists && targetExists && edge.source !== edge.target) {
        const sourceNode = graph.nodesById.get(edge.source);
        const targetNode = graph.nodesById.get(edge.target);
        const sourceCategory = sourceNode.category;
        const targetCategory = targetNode.category;

        // Rule A: Source cannot connect directly to another Source
        if (
          sourceCategory === NODE_CATEGORIES.DATA_SOURCE &&
          targetCategory === NODE_CATEGORIES.DATA_SOURCE
        ) {
          errors.push(
            createValidationError(
              ERROR_CODES.UNSUPPORTED_CONNECTION,
              prefix,
              `Unsupported connection at ${prefix}: Cannot connect data source "${sourceNode.id}" directly to another data source "${targetNode.id}". Telemetry streams must flow to math operations or action triggers.`,
              { sourceId: sourceNode.id, targetId: targetNode.id }
            )
          );
        }
        // Rule B: Action cannot connect to Action
        else if (
          sourceCategory === NODE_CATEGORIES.ACTION_TRIGGER &&
          targetCategory === NODE_CATEGORIES.ACTION_TRIGGER
        ) {
          errors.push(
            createValidationError(
              ERROR_CODES.UNSUPPORTED_CONNECTION,
              prefix,
              `Unsupported connection at ${prefix}: Cannot connect action "${sourceNode.id}" directly to another action "${targetNode.id}". Actions are terminal sinks.`,
              { sourceId: sourceNode.id, targetId: targetNode.id }
            )
          );
        }
        // Rule C: Data sources cannot have incoming edges
        else if (targetCategory === NODE_CATEGORIES.DATA_SOURCE) {
          errors.push(
            createValidationError(
              ERROR_CODES.UNSUPPORTED_CONNECTION,
              prefix,
              `Unsupported connection at ${prefix}: Data source node "${targetNode.id}" (${targetNode.type}) cannot have incoming edges. Data sources are root stream entry points.`,
              {
                sourceId: sourceNode.id,
                targetId: targetNode.id,
                sourceCategory,
                targetCategory,
              }
            )
          );
        }
        // Rule D: Action triggers cannot have outgoing edges
        else if (sourceCategory === NODE_CATEGORIES.ACTION_TRIGGER) {
          errors.push(
            createValidationError(
              ERROR_CODES.UNSUPPORTED_CONNECTION,
              prefix,
              `Unsupported connection at ${prefix}: Action trigger node "${sourceNode.id}" (${sourceNode.type}) cannot have outgoing edges. Action nodes are terminal sinks.`,
              {
                sourceId: sourceNode.id,
                targetId: targetNode.id,
                sourceCategory,
                targetCategory,
              }
            )
          );
        }
      }
    }

    // 5. Cycle Detection (Acyclic Graph Requirement)
    if (opts.requireAcyclic && !graph.isAcyclic) {
      for (const cycle of graph.cycles) {
        const cycleStr = cycle.join(' -> ');
        errors.push(
          createValidationError(
            ERROR_CODES.CYCLE_DETECTED,
            'edges',
            `Cycle detected in workflow graph: ${cycleStr}. Workflow execution requires an acyclic execution graph (DAG) for RxJS stream compilation.`,
            { cycle }
          )
        );
      }
    }

    // 6. Source Node Requirement
    const actualDataSources = graph.nodes.filter(
      (n) => n.category === NODE_CATEGORIES.DATA_SOURCE
    );
    if (opts.requireSourceNode && actualDataSources.length === 0) {
      errors.push(
        createValidationError(
          ERROR_CODES.MISSING_SOURCE_NODE,
          'nodes',
          'Workflow graph must contain at least one data source node (e.g., dataSource, temperatureSensor, turbineSensor) to ingest telemetry streams.',
          { totalNodes: graph.nodes.length, sourceCount: 0 }
        )
      );
    }

    // 7. Action/Sink Node Requirement
    const actualActionSinks = graph.nodes.filter(
      (n) => n.category === NODE_CATEGORIES.ACTION_TRIGGER
    );
    if (opts.requireSinkNode && actualActionSinks.length === 0) {
      errors.push(
        createValidationError(
          ERROR_CODES.MISSING_ACTION_NODE,
          'nodes',
          'Workflow graph must contain at least one action trigger node (e.g., action, smsAlert, webhook) as a stream sink.',
          { totalNodes: graph.nodes.length, actionCount: 0 }
        )
      );
    }

    // 8. Graph Structure Diagnostics (Orphans, Unreachable, Dead Ends)
    if (graph.nodes.length > 1) {
      // 8.1 Disconnected / Orphan Nodes
      if (!opts.allowDisconnectedNodes) {
        for (const orphan of graph.reachability.orphanNodes) {
          errors.push(
            createValidationError(
              ERROR_CODES.DISCONNECTED_NODE,
              `nodes[${orphan.index}]`,
              `Disconnected node "${orphan.id}" (${orphan.type}) has no incoming or outgoing connections and cannot participate in stream execution.`,
              { nodeId: orphan.id, type: orphan.type, index: orphan.index }
            )
          );
        }
      }

      // 8.2 Unreachable Nodes from Data Sources
      if (!opts.allowUnreachableNodes && actualDataSources.length > 0) {
        for (const unreach of graph.reachability.unreachableNodes) {
          // Skip if already flagged as orphan
          if (graph.reachability.orphanNodes.some((o) => o.id === unreach.id)) continue;

          errors.push(
            createValidationError(
              ERROR_CODES.UNREACHABLE_NODE,
              `nodes[${unreach.index}]`,
              `Node "${unreach.id}" (${unreach.type}) is unreachable from any data source node. It will never receive telemetry data in the execution stream.`,
              { nodeId: unreach.id, type: unreach.type, index: unreach.index }
            )
          );
        }
      }

      // 8.3 Dead-End Intermediate Nodes
      if (!opts.allowDeadEnds) {
        for (const deadEnd of graph.reachability.deadEndNodes) {
          errors.push(
            createValidationError(
              ERROR_CODES.DEAD_END_NODE,
              `nodes[${deadEnd.index}]`,
              `Intermediate operation node "${deadEnd.id}" (${deadEnd.type}) has incoming connections but no outgoing connection to a downstream transform or action sink.`,
              { nodeId: deadEnd.id, type: deadEnd.type, index: deadEnd.index }
            )
          );
        }
      }
    }

    const summary = {
      totalNodes: graph.nodes.length,
      totalEdges: graph.edges.length,
      dataSourcesCount: actualDataSources.length,
      actionSinksCount: actualActionSinks.length,
      isAcyclic: graph.isAcyclic,
      topologicalOrder: graph.topologicalOrder,
      hasCycles: graph.cycles.length > 0,
      detectedCycles: graph.cycles,
      errorCount: errors.length,
      warningCount: warnings.length,
    };

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      summary,
      graph,
    };
  }
}

export const defaultValidator = new GraphValidator();
export const validateGraph = (rawInput, options) => {
  const validator = options?.registry ? new GraphValidator(options) : defaultValidator;
  return validator.validate(rawInput, options);
};
