
import { ExecutionHistory } from '../models/executionHistory.model.js';
import { isConnected } from '../config/db.js';
import { ApiError } from '../utils/apiError.js';

export class ExecutionHistoryRepository {
  constructor(options = {}) {
    this.model = options.model || ExecutionHistory;
    this._mockStore = null;
  }

  setStore(store) {
    this._mockStore = store;
  }

  resetStore() {
    this._mockStore = null;
  }

  _ensureDatabaseAvailable() {
    if (this._mockStore) return;

    if (!isConnected()) {
      throw new ApiError(
        503,
        'Database service unavailable. Please retry later.'
      );
    }
  }

  _formatDocument(doc) {
    if (!doc) return null;

    const obj =
      typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };

    const id = obj._id ? obj._id.toString() : obj.id;

    return {
      ...obj,
      id,
      _id: id,
    };
  }

  async createExecution(data) {
    this._ensureDatabaseAvailable();

    try {
      if (this._mockStore) {
        const id = data.id || `execution_${this._mockStore.length + 1}`;
        const record = { ...data, id, _id: id };

        this._mockStore.push(record);
        return this._formatDocument(record);
      }

      const execution = await this.model.create(data);
      return this._formatDocument(execution);
    } catch (err) {
      if (err instanceof ApiError) throw err;

      if (
        err.name === 'MongoServerSelectionError' ||
        err.name === 'MongoNetworkError'
      ) {
        throw new ApiError(503, 'Database service unavailable. Please retry later.');
      }

      throw new ApiError(500, `Failed to create execution history: ${err.message}`);
    }
  }

  async findById(id) {
    this._ensureDatabaseAvailable();

    try {
      if (this._mockStore) {
        const found = this._mockStore.find(
          (item) => item.id === id || item._id === id
        );

        return found ? this._formatDocument(found) : null;
      }

      const execution = await this.model.findById(id);
      return execution ? this._formatDocument(execution) : null;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(500, `Failed to find execution history: ${err.message}`);
    }
  }

  async findByWorkflowId(workflowId, options = {}) {
    this._ensureDatabaseAvailable();

    const { limit = 20, skip = 0 } = options;

    if (this._mockStore) {
      return this._mockStore
        .filter((item) => String(item.workflowId) === String(workflowId))
        .sort(
          (a, b) => new Date(b.executedAt) - new Date(a.executedAt)
        )
        .slice(skip, skip + limit)
        .map((item) => this._formatDocument(item));
    }

    const executions = await this.model
      .find({ workflowId })
      .sort({ executedAt: -1 })
      .skip(skip)
      .limit(limit);

    return executions.map((item) => this._formatDocument(item));
  }

  async findRecent(options = {}) {
    this._ensureDatabaseAvailable();

    const { limit = 50, skip = 0 } = options;

    if (this._mockStore) {
      return [...this._mockStore]
        .sort(
          (a, b) => new Date(b.executedAt) - new Date(a.executedAt)
        )
        .slice(skip, skip + limit)
        .map((item) => this._formatDocument(item));
    }

    const executions = await this.model
      .find()
      .sort({ executedAt: -1 })
      .skip(skip)
      .limit(limit);

    return executions.map((item) => this._formatDocument(item));
  }

  async countRecent() {
    this._ensureDatabaseAvailable();

    if (this._mockStore) {
      return this._mockStore.length;
    }

    return this.model.countDocuments();
  }

  async countByWorkflowId(workflowId) {
    this._ensureDatabaseAvailable();

    if (this._mockStore) {
      return this._mockStore.filter(
        (item) => String(item.workflowId) === String(workflowId)
      ).length;
    }

    return this.model.countDocuments({ workflowId });
  }
}

export const executionHistoryRepository =
  new ExecutionHistoryRepository();

export default executionHistoryRepository;
