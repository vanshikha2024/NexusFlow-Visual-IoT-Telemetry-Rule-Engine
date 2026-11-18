
import { executionHistoryService } from "../services/executionHistory.service.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// GET /api/execution-history
export const getRecentHistory = asyncHandler(async (req, res) => {
  const result = await executionHistoryService.getRecentHistory(req.query);

  return ApiResponse.success(
    res,
    result,
    "Execution history retrieved successfully"
  );
});

// GET /api/execution-history/:id
export const getExecutionById = asyncHandler(async (req, res) => {
  const execution = await executionHistoryService.getExecutionById(
    req.params.id
  );

  return ApiResponse.success(
    res,
    execution,
    "Execution details retrieved successfully"
  );
});

// GET /api/execution-history/workflow/:workflowId
export const getWorkflowHistory = asyncHandler(async (req, res) => {
  const result = await executionHistoryService.getWorkflowHistory(
    req.params.workflowId,
    req.query
  );

  return ApiResponse.success(
    res,
    result,
    "Workflow execution history retrieved successfully"
  );
});
