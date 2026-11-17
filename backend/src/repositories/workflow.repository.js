import mongoose from 'mongoose';
import { Workflow } from '../models/workflow.model.js';
import { isConnected } from '../config/db.js';
import { ApiError } from '../utils/apiError.js';
import { logger } from '../utils/logger.js';

/**
 * Workflow Repository
 *
 * Encapsulates persistence logic for visual rule engine workflows.
 * Stores graphs in the dedicated 'workflows' collection, strictly separate
 * from the telemetry time-series storage.
 */
export class WorkflowRepository {
  /**
   * @param {Object} [options={}]
   * @param {import('mongoose').Model} [options.model] - Mongoose model
   */
  constructor(options = {}) {
    this.model = options.model || Workflow;
    this._mockStore = null; // Test double store
  }

  /**
   * Injects an in-memory mock store for testing without live MongoDB.
   * @param {Array<Object>} store
   */
  setStore(store) {
    this._mockStore = store;
  }

  /**
   * Resets injected mock store back to default database model.
   */
  resetStore() {
    this._mockStore = null;
  }

  /**
   * Verifies database readiness or active test double.
   * @throws {ApiError} If database is not ready
   */
  _ensureDatabaseAvailable() {
    if (this._mockStore) return;
    if (!isConnected()) {
      throw new ApiError(503, 'Database service unavailable. Please retry later.');
    }
  }

  /**
   * Normalizes document for client output, ensuring both 'id' and '_id' exist as strings.
   * @param {Object} doc
   * @returns {Object}
   */
  _formatDocument(doc) {
    if (!doc) return null;
    const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
    const idStr = obj._id ? obj._id.toString() : obj.id;
    return {
      ...obj,
      id: idStr,
      _id: idStr,
    };
  }

  /**
   * Creates and saves a new workflow graph document.
   *
   * @param {Object} data
   * @returns {Promise<Object>} Persisted workflow
   */
  async createWorkflow(data) {
    this._ensureDatabaseAvailable();

    try {
      const now = new Date().toISOString();
      const workflowData = {
        name: data.name.trim(),
        description: data.description ? data.description.trim() : '',
        status: data.status || 'draft',
        version: 1,
        nodes: (data.nodes || []).map((node) => ({
          id: node.id.trim(),
          type: node.type.trim(),
          label: node.label || node.data?.label || '',
          position: node.position || { x: 0, y: 0 },
          data: node.data || {},
          config: node.config || {},
        })),
        edges: (data.edges || []).map((edge, idx) => ({
          id: edge.id || `e_${edge.source.trim()}_${edge.target.trim()}_${idx}`,
          source: edge.source.trim(),
          target: edge.target.trim(),
          sourceHandle: edge.sourceHandle || null,
          targetHandle: edge.targetHandle || null,
          animated: Boolean(edge.animated),
          style: edge.style || {},
        })),
        metadata: data.metadata || {},
        createdAt: now,
        updatedAt: now,
      };

      if (this._mockStore) {
        const id = data.id || `wf_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const record = { _id: id, id, ...workflowData };
        this._mockStore.push(record);
        return this._formatDocument(record);
      }

      const doc = await this.model.create(workflowData);
      return this._formatDocument(doc);
    } catch (err) {
      if (err.name === 'MongoServerSelectionError' || err.name === 'MongoNetworkError') {
        throw new ApiError(503, 'Database service unavailable. Please retry later.');
      }
      if (err instanceof ApiError) throw err;
      throw new ApiError(500, `Failed to create workflow: ${err.message}`);
    }
  }

  /**
   * Finds a single workflow by its unique ID (supports ObjectId or custom string ID).
   *
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async findWorkflowById(id) {
    this._ensureDatabaseAvailable();

    if (!id || typeof id !== 'string') return null;
    const cleanId = id.trim();

    try {
      if (this._mockStore) {
        const found = this._mockStore.find(
          (w) => w.id === cleanId || w._id === cleanId
        );
        return found ? this._formatDocument(found) : null;
      }

      let doc = null;
      if (mongoose.Types.ObjectId.isValid(cleanId)) {
        doc = await this.model.findById(cleanId).lean();
      }
      if (!doc) {
        doc = await this.model
          .findOne({ $or: [{ id: cleanId }, { _id: cleanId }] })
          .lean();
      }

      return doc ? this._formatDocument(doc) : null;
    } catch (err) {
      if (err.name === 'MongoServerSelectionError' || err.name === 'MongoNetworkError') {
        throw new ApiError(503, 'Database service unavailable. Please retry later.');
      }
      if (err instanceof ApiError) throw err;
      throw new ApiError(500, `Failed to find workflow: ${err.message}`);
    }
  }

  /**
   * Lists all workflows with optional filtering and sorting.
   *
   * @param {Object} [filter={}]
   * @param {Object} [options={}]
   * @returns {Promise<Array<Object>>}
   */
  async findWorkflows(filter = {}, options = {}) {
    this._ensureDatabaseAvailable();

    const limit = Math.min(parseInt(options.limit, 10) || 50, 100);
    const skip = Math.max(parseInt(options.skip, 10) || 0, 0);

    try {
      if (this._mockStore) {
        let results = [...this._mockStore];
        if (filter.status) {
          results = results.filter((w) => w.status === filter.status);
        }
        return results.slice(skip, skip + limit).map((doc) => this._formatDocument(doc));
      }

      const docs = await this.model
        .find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      return docs.map((doc) => this._formatDocument(doc));
    } catch (err) {
      if (err.name === 'MongoServerSelectionError' || err.name === 'MongoNetworkError') {
        throw new ApiError(503, 'Database service unavailable. Please retry later.');
      }
      if (err instanceof ApiError) throw err;
      throw new ApiError(500, `Failed to list workflows: ${err.message}`);
    }
  }

  /**
   * Updates an existing workflow by its ID.
   * Increments the schema version and updates the timestamp.
   *
   * @param {string} id
   * @param {Object} updateData
   * @returns {Promise<Object|null>} Updated workflow or null if not found
   */
  async updateWorkflowById(id, updateData) {
    this._ensureDatabaseAvailable();

    if (!id || typeof id !== 'string') return null;
    const cleanId = id.trim();

    try {
      const now = new Date().toISOString();

      if (this._mockStore) {
        const index = this._mockStore.findIndex(
          (w) => w.id === cleanId || w._id === cleanId
        );
        if (index === -1) return null;

        const current = this._mockStore[index];
        const updated = {
          ...current,
          ...(updateData.name ? { name: updateData.name.trim() } : {}),
          ...(updateData.description !== undefined
            ? { description: updateData.description.trim() }
            : {}),
          ...(updateData.status ? { status: updateData.status } : {}),
          ...(updateData.nodes
            ? {
                nodes: updateData.nodes.map((node) => ({
                  id: node.id.trim(),
                  type: node.type.trim(),
                  label: node.label || node.data?.label || '',
                  position: node.position || { x: 0, y: 0 },
                  data: node.data || {},
                  config: node.config || {},
                })),
              }
            : {}),
          ...(updateData.edges
            ? {
                edges: updateData.edges.map((edge, idx) => ({
                  id: edge.id || `e_${edge.source.trim()}_${edge.target.trim()}_${idx}`,
                  source: edge.source.trim(),
                  target: edge.target.trim(),
                  sourceHandle: edge.sourceHandle || null,
                  targetHandle: edge.targetHandle || null,
                  animated: Boolean(edge.animated),
                  style: edge.style || {},
                })),
              }
            : {}),
          ...(updateData.metadata ? { metadata: updateData.metadata } : {}),
          version: (current.version || 1) + 1,
          updatedAt: now,
        };

        this._mockStore[index] = updated;
        return this._formatDocument(updated);
      }

      // Build Mongoose update object
      const updateFields = {
        $inc: { version: 1 },
        $set: { updatedAt: now },
      };

      if (updateData.name) updateFields.$set.name = updateData.name.trim();
      if (updateData.description !== undefined) {
        updateFields.$set.description = updateData.description.trim();
      }
      if (updateData.status) updateFields.$set.status = updateData.status;
      if (updateData.nodes) updateFields.$set.nodes = updateData.nodes;
      if (updateData.edges) updateFields.$set.edges = updateData.edges;
      if (updateData.metadata) updateFields.$set.metadata = updateData.metadata;

      let filter = { _id: cleanId };
      if (mongoose.Types.ObjectId.isValid(cleanId)) {
        filter = { _id: cleanId };
      } else {
        filter = { $or: [{ id: cleanId }, { _id: cleanId }] };
      }

      const updatedDoc = await this.model
        .findOneAndUpdate(filter, updateFields, { new: true, runValidators: true })
        .lean();

      return updatedDoc ? this._formatDocument(updatedDoc) : null;
    } catch (err) {
      if (err.name === 'MongoServerSelectionError' || err.name === 'MongoNetworkError') {
        throw new ApiError(503, 'Database service unavailable. Please retry later.');
      }
      if (err instanceof ApiError) throw err;
      throw new ApiError(500, `Failed to update workflow: ${err.message}`);
    }
  }

  /**
   * Deletes a workflow by its ID.
   *
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async deleteWorkflowById(id) {
    this._ensureDatabaseAvailable();

    if (!id || typeof id !== 'string') return false;
    const cleanId = id.trim();

    try {
      if (this._mockStore) {
        const index = this._mockStore.findIndex(
          (w) => w.id === cleanId || w._id === cleanId
        );
        if (index === -1) return false;
        this._mockStore.splice(index, 1);
        return true;
      }

      let filter = { _id: cleanId };
      if (mongoose.Types.ObjectId.isValid(cleanId)) {
        filter = { _id: cleanId };
      } else {
        filter = { $or: [{ id: cleanId }, { _id: cleanId }] };
      }

      const result = await this.model.findOneAndDelete(filter);
      return Boolean(result);
    } catch (err) {
      if (err.name === 'MongoServerSelectionError' || err.name === 'MongoNetworkError') {
        throw new ApiError(503, 'Database service unavailable. Please retry later.');
      }
      if (err instanceof ApiError) throw err;
      throw new ApiError(500, `Failed to delete workflow: ${err.message}`);
    }
  }
}

export const workflowRepository = new WorkflowRepository();
export default workflowRepository;
