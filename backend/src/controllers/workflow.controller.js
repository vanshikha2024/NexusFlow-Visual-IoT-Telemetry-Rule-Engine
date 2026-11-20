import { workflowService } from '../services/workflow.service.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateGraph, resolveGraphDependencies } from '../graph/index.js';

/**
 * Helper to serialize Map instances in ExecutionPlan to JSON-friendly objects
 */
const serializePlan = (plan) => {
  if (!plan) return null;
  return {
    ...plan,
    nodesById:
      plan.nodesById instanceof Map
        ? Object.fromEntries(plan.nodesById)
        : plan.nodesById,
    adjacency:
      plan.adjacency instanceof Map
        ? Object.fromEntries(plan.adjacency)
        : plan.adjacency,
    reverseAdjacency:
      plan.reverseAdjacency instanceof Map
        ? Object.fromEntries(plan.reverseAdjacency)
        : plan.reverseAdjacency,
    inDegree:
      plan.inDegree instanceof Map
        ? Object.fromEntries(plan.inDegree)
        : plan.inDegree,
    outDegree:
      plan.outDegree instanceof Map
        ? Object.fromEntries(plan.outDegree)
        : plan.outDegree,
  };
};

/**
 * Create a new visual workflow graph.
 * POST /api/workflows
 */
export const createWorkflow = asyncHandler(async (req, res) => {
  const result = await workflowService.createWorkflow(req.body);
  return ApiResponse.success(
    res,
    result,
    'Workflow created successfully',
    201
  );
});

/**
 * Retrieve a workflow by its unique ID.
 * GET /api/workflows/:id
 */
export const getWorkflowById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const workflow = await workflowService.getWorkflowById(id);
  return ApiResponse.success(
    res,
    workflow,
    `Workflow "${workflow.name}" retrieved successfully`
  );
});

/**
 * List all visual workflows with optional status filtering.
 * GET /api/workflows
 */
export const listWorkflows = asyncHandler(async (req, res) => {
  const { status, limit, skip } = req.query;
  const result = await workflowService.listWorkflows({ status, limit, skip });
  return ApiResponse.success(
    res,
    result,
    `Retrieved ${result.count} workflows`
  );
});

/**
 * Update an existing workflow graph by ID.
 * PUT /api/workflows/:id
 */
export const updateWorkflow = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updated = await workflowService.updateWorkflow(id, req.body);
  return ApiResponse.success(
    res,
    updated,
    `Workflow "${updated.name}" updated successfully (version ${updated.version})`
  );
});

/**
 * Delete a workflow by ID.
 * DELETE /api/workflows/:id
 */
export const deleteWorkflow = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await workflowService.deleteWorkflow(id);
  return ApiResponse.success(
    res,
    result,
    `Workflow "${id}" deleted successfully`
  );
});

/**
 * Validate a visual workflow graph payload.
 * POST /api/workflows/validate
 */
export const validateWorkflowGraph = asyncHandler(async (req, res) => {
  const result = validateGraph(req.body);
  if (!result.isValid) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: 'Workflow graph validation failed.',
      errors: result.errors,
      warnings: result.warnings,
      summary: result.summary,
    });
  }
  return ApiResponse.success(
    res,
    {
      isValid: true,
      summary: result.summary,
      topologicalOrder: result.summary?.topologicalOrder || [],
    },
    'Workflow graph is valid and ready for execution.',
    200
  );
});

/**
 * Validate an existing saved workflow graph by ID.
 * GET /api/workflows/:id/validate
 */
export const validateSavedWorkflow = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const workflow = await workflowService.getWorkflowById(id);
  const result = validateGraph(workflow);
  if (!result.isValid) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: `Workflow "${workflow.name}" validation failed.`,
      errors: result.errors,
      warnings: result.warnings,
      summary: result.summary,
    });
  }
  return ApiResponse.success(
    res,
    {
      workflowId: id,
      workflowName: workflow.name,
      isValid: true,
      summary: result.summary,
      topologicalOrder: result.summary?.topologicalOrder || [],
    },
    `Workflow "${workflow.name}" is valid and ready for execution.`,
    200
  );
});

/**
 * Resolve execution dependencies for a submitted visual workflow graph.
 * POST /api/workflows/resolve
 */
export const resolveWorkflowDependencies = asyncHandler(async (req, res) => {
  const resolveOpts = {};
  const strategy = req.query.strategy || req.body?.strategy;
  if (strategy) resolveOpts.strategy = strategy;

  const result = resolveGraphDependencies(req.body, resolveOpts);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: 'Workflow dependency resolution failed.',
      errors: result.errors,
      warnings: result.warnings,
    });
  }

  return ApiResponse.success(
    res,
    serializePlan(result.plan),
    'Workflow dependency resolution succeeded.',
    200
  );
});

/**
 * Resolve execution dependencies for a saved workflow in the database.
 * GET /api/workflows/:id/resolve
 */
export const resolveSavedWorkflowDependencies = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const workflow = await workflowService.getWorkflowById(id);
  const resolveOpts = {
    workflowId: id,
    workflowName: workflow.name,
  };
  if (req.query.strategy) {
    resolveOpts.strategy = req.query.strategy;
  }

  const result = resolveGraphDependencies(workflow, resolveOpts);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: `Failed to resolve dependencies for workflow "${workflow.name}".`,
      errors: result.errors,
      warnings: result.warnings,
    });
  }

  return ApiResponse.success(
    res,
    serializePlan(result.plan),
    `Dependencies for workflow "${workflow.name}" resolved successfully.`,
    200
  );
});

