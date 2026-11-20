import { workflowService } from '../services/workflow.service.js';
import { workflowExecutionService } from '../services/workflowExecution.service.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateGraph } from "../graph/index.js";

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
 * Execute a saved workflow in simulation mode.
 * POST /api/workflows/:id/execute
 */
export const executeWorkflow = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const workflow = await workflowService.getWorkflowById(id);

  const result = await workflowExecutionService.executeWorkflow(workflow);

  return ApiResponse.success(
    res,
    result,
    "Workflow simulation completed successfully"
  );
});

export const validateWorkflowGraph = asyncHandler(async (req, res) => {
  const { nodes = [], edges = [] } = req.body;

  const validation = validateGraph({ nodes, edges });

  return ApiResponse.success(
    res,
    {
      isValid: validation.isValid,
      errors: validation.errors,
      warnings: validation.warnings,
      summary: validation.summary,
    },
    validation.isValid
      ? "Workflow validation successful"
      : "Workflow validation failed"
  );
});

