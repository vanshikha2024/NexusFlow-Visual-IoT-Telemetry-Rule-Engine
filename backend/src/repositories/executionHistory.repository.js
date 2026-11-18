
import { ExecutionHistory } from '../models/executionHistory.model.js';

export class ExecutionHistoryRepository {
  async createExecution(data) {
    const execution = await ExecutionHistory.create(data);
    return execution.toJSON();
  }

  async findById(id) {
    const execution = await ExecutionHistory.findById(id);

    return execution ? execution.toJSON() : null;
  }

  async findByWorkflowId(workflowId, options = {}) {
    const { limit = 20, skip = 0 } = options;

    const executions = await ExecutionHistory.find({ workflowId })
      .sort({ executedAt: -1 })
      .skip(skip)
      .limit(limit);

    return executions.map((execution) => execution.toJSON());
  }

  async findRecent(options = {}) {
    const { limit = 50, skip = 0 } = options;

    const executions = await ExecutionHistory.find()
      .sort({ executedAt: -1 })
      .skip(skip)
      .limit(limit);

    return executions.map((execution) => execution.toJSON());
  }

  async countByWorkflowId(workflowId) {
    return ExecutionHistory.countDocuments({ workflowId });
  }
}

export const executionHistoryRepository =
  new ExecutionHistoryRepository();

export default executionHistoryRepository;
