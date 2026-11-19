
import {
  executionHistoryRepository,
} from "../repositories/executionHistory.repository.js";

import { workflowService } from "./workflow.service.js";
import { ApiError } from "../utils/apiError.js";

export class ExecutionHistoryService {
  async getWorkflowHistory(workflowId, query = {}) {
    await workflowService.getWorkflowById(workflowId);

    const limit = Math.min(
      Math.max(Number(query.limit) || 20, 1),
      100
    );

    const skip = Math.max(Number(query.skip) || 0, 0);

    const [executions, count] = await Promise.all([
      executionHistoryRepository.findByWorkflowId(workflowId, {
        limit,
        skip,
      }),
      executionHistoryRepository.countByWorkflowId(workflowId),
    ]);

    return { executions, count };
  }

  async getExecutionById(id) {
    const execution = await executionHistoryRepository.findById(id);

    if (!execution) {
      throw new ApiError(404, "Execution history record not found.");
    }

    return execution;
  }

  async getRecentHistory(query = {}) {
    const limit = Math.min(
      Math.max(Number(query.limit) || 50, 1),
      100
    );

    const skip = Math.max(Number(query.skip) || 0, 0);

    const [executions, count] = await Promise.all([
      executionHistoryRepository.findRecent({
        limit,
        skip,
      }),
      executionHistoryRepository.countRecent(),
    ]);
    return { executions, count };
  }
}

export const executionHistoryService =
  new ExecutionHistoryService();

export default executionHistoryService;
