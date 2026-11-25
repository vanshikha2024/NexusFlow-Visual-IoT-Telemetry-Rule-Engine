import { merge } from 'rxjs';
import { share } from 'rxjs/operators';
import { GraphDependencyResolver, defaultResolver } from '../graph/dependencyResolver.js';
import { ExecutionContext } from './executionContext.js';
import { resolveHandlerFactory } from './handlers/index.js';

/**
 * NexusFlow Logic Compiler (Day 9)
 *
 * Converts validated visual workflow graphs (React Flow JSON) into executable
 * RxJS Observable pipelines. Integrates graph parsing, structural validation,
 * topological dependency resolution, sliding window math, thresholds, and mock alert sinks.
 */
export class NexusFlowLogicCompiler {
  /**
   * @param {Object} [options={}]
   * @param {GraphDependencyResolver} [options.resolver]
   */
  constructor(options = {}) {
    this.resolver = options.resolver || defaultResolver;
  }

  /**
   * Compiles a workflow JSON or object into an executable RxJS pipeline.
   *
   * @param {string|Object} workflowInput - React Flow JSON or workflow document
   * @param {Object} [compileOptions={}]
   * @param {Array<number|Object>} [compileOptions.sequence] - Predefined sample sequence
   * @param {ExecutionContext} [compileOptions.context] - Existing or custom execution context
   * @param {'PRUNE'|'REJECT'|'WARN'} [compileOptions.strategy='PRUNE'] - Disconnected node strategy
   * @returns {{
   *   success: boolean,
   *   workflowId?: string,
   *   workflowName?: string,
   *   plan?: Object,
   *   context?: ExecutionContext,
   *   observables?: Map<string, import('rxjs').Observable>,
   *   errors?: Array<Object>,
   *   warnings?: Array<Object>,
   *   dispose?: () => void
   * }}
   */
  compile(workflowInput, compileOptions = {}) {
    // 1. Dependency Resolution (integrates GraphParser and GraphValidator)
    const resolveResult = this.resolver.resolve(workflowInput, {
      strategy: compileOptions.strategy,
      validateFirst: compileOptions.validateFirst !== false,
      workflowId: compileOptions.workflowId,
      workflowName: compileOptions.workflowName,
    });

    if (!resolveResult.success || !resolveResult.plan) {
      return {
        success: false,
        workflowId: null,
        workflowName: null,
        plan: null,
        context: null,
        observables: null,
        errors: resolveResult.errors || [],
        warnings: resolveResult.warnings || [],
      };
    }

    const plan = resolveResult.plan;
    const context = compileOptions.context || new ExecutionContext();
    const observables = new Map();
    const compileErrors = [];

    // 2. Build Observables in Topological Order
    for (const nodeId of plan.topologicalOrder) {
      const node = plan.nodesById.get(nodeId);
      const factory = resolveHandlerFactory(node);

      if (!factory) {
        compileErrors.push({
          code: 'UNSUPPORTED_COMPILER_NODE',
          nodeId: node.id,
          message: `No RxJS handler factory found for node "${node.id}" of type "${node.type}".`,
        });
        continue;
      }

      if (node.isSource) {
        // Source node: creates root Observable
        try {
          const source$ = factory(node, context, compileOptions).pipe(share());
          observables.set(node.id, source$);
        } catch (err) {
          compileErrors.push({
            code: 'SOURCE_INIT_ERROR',
            nodeId: node.id,
            message: `Failed to initialize source observable for node "${node.id}": ${err.message}`,
          });
        }
      } else {
        // Intermediate Operator or Sink node
        const upstreamNodes = node.upstream || [];
        const upstreamObservables = upstreamNodes
          .map((u) => observables.get(u.sourceId))
          .filter(Boolean);

        if (upstreamObservables.length === 0) {
          compileErrors.push({
            code: 'MISSING_UPSTREAM_STREAM',
            nodeId: node.id,
            message: `Node "${node.id}" has no compiled upstream observable streams.`,
          });
          continue;
        }

        const input$ =
          upstreamObservables.length === 1
            ? upstreamObservables[0]
            : merge(...upstreamObservables);

        try {
          const operator = factory(node, context, compileOptions);
          const current$ = input$.pipe(operator, share());
          observables.set(node.id, current$);

          // If sink, automatically attach subscriber to activate the pipeline
          if (node.isSink) {
            const subscription = current$.subscribe({
              next: () => {},
              error: (err) => {
                context.recordError(node.id, err);
              },
            });
            context.addSubscription(subscription);
          }
        } catch (err) {
          compileErrors.push({
            code: 'OPERATOR_INIT_ERROR',
            nodeId: node.id,
            message: `Failed to initialize operator for node "${node.id}": ${err.message}`,
          });
        }
      }
    }

    if (compileErrors.length > 0) {
      context.dispose();
      return {
        success: false,
        workflowId: plan.workflowId,
        workflowName: plan.workflowName,
        plan,
        context: null,
        observables: null,
        errors: [...resolveResult.errors, ...compileErrors],
        warnings: resolveResult.warnings,
      };
    }

    return {
      success: true,
      workflowId: plan.workflowId,
      workflowName: plan.workflowName,
      plan,
      context,
      observables,
      errors: [],
      warnings: resolveResult.warnings,
      dispose: () => context.dispose(),
    };
  }

  /**
   * High-level workflow execution helper.
   * Compiles the workflow and feeds a telemetry sequence through the pipeline.
   *
   * @param {string|Object} workflowInput
   * @param {Object} [executeOptions={}]
   * @param {Array<number|Object>} [executeOptions.sequence] - Sample telemetry sequence
   * @param {string} [executeOptions.sensorId] - Target sensorId to feed
   * @returns {Object}
   */
  execute(workflowInput, executeOptions = {}) {
    const sequence = executeOptions.sequence || null;
    const compiled = this.compile(workflowInput, executeOptions);

    if (!compiled.success) {
      return {
        success: false,
        workflowId: null,
        alerts: [],
        emissions: {},
        errors: compiled.errors,
        warnings: compiled.warnings,
        plan: null,
        summary: {
          totalSamplesFed: 0,
          alertCount: 0,
          hasErrors: true,
        },
      };
    }

    const { context, plan } = compiled;

    // If a dynamic sequence is provided, feed it to the appropriate sensor subject
    if (Array.isArray(sequence) && sequence.length > 0) {
      const primarySensorId =
        executeOptions.sensorId ||
        plan.sources[0]?.config?.sensorId ||
        plan.sources[0]?.data?.sensorId ||
        plan.sources[0]?.id ||
        'default-sensor';

      for (const sample of sequence) {
        context.feed(primarySensorId, sample);
      }
    }

    const alerts = context.getAlerts();
    const emissions = context.getAllEmissions();
    const errors = context.getErrors();

    return {
      success: true,
      workflowId: plan.workflowId,
      workflowName: plan.workflowName,
      alerts,
      emissions,
      errors,
      warnings: compiled.warnings,
      plan,
      summary: {
        totalSamplesFed: Array.isArray(sequence) ? sequence.length : 0,
        alertCount: alerts.length,
        hasErrors: context.hasErrors(),
        pipelinesRun: plan.pipelines.length,
      },
      dispose: () => compiled.dispose(),
    };
  }
}

export const defaultCompiler = new NexusFlowLogicCompiler();

/**
 * Convenience helper to compile a visual workflow graph.
 */
export const compileWorkflow = (rawInput, options) => {
  return defaultCompiler.compile(rawInput, options);
};

/**
 * Convenience helper to execute a visual workflow graph with a sequence.
 */
export const executeWorkflow = (rawInput, options) => {
  return defaultCompiler.execute(rawInput, options);
};

