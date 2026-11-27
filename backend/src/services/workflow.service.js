import { workflowRepository } from '../repositories/workflow.repository.js';
import { ApiError } from '../utils/apiError.js';
import { logger } from '../utils/logger.js';
import { validateGraph as validateWorkflowGraph } from '../validators/workflow.validator.js';

export class WorkflowService {
  /**
   * @param {import('../repositories/workflow.repository.js').WorkflowRepository} [repo]
   */
  constructor(repo = workflowRepository) {
    this.repo = repo;
  }

  /**
   * Creates a new visual workflow graph.
   *
   * @param {Object} data
   * @returns {Promise<Object>} Created workflow
   */
  async createWorkflow(data) {
    const result = await this.repo.createWorkflow(data);
    logger.info(
      `Created workflow "${result.name}" (ID: ${result.id}, nodes: ${result.nodes?.length || 0}, edges: ${result.edges?.length || 0})`
    );
    return result;
  }

  /**
   * Retrieves a workflow by its unique ID.
   *
   * @param {string} id
   * @throws {ApiError} 404 if workflow does not exist
   * @returns {Promise<Object>} Workflow document
   */
  async getWorkflowById(id) {
    const workflow = await this.repo.findWorkflowById(id);
    if (!workflow) {
      throw new ApiError(404, `Workflow not found with ID "${id}".`);
    }
    return workflow;
  }

  /**
   * Lists workflows with optional filtering and pagination.
   *
   * @param {Object} [query={}]
   * @returns {Promise<{ workflows: Array<Object>, count: number }>}
   */
  async listWorkflows(query = {}) {
    const filter = {};
    if (query.status) {
      filter.status = query.status.toLowerCase();
    }

    const workflows = await this.repo.findWorkflows(filter, {
      limit: query.limit,
      skip: query.skip,
    });

    return {
      workflows,
      count: workflows.length,
    };
  }

  /**
   * Updates an existing workflow by its ID.
   *
   * @param {string} id
   * @param {Object} updateData
   * @throws {ApiError} 404 if workflow does not exist
   * @returns {Promise<Object>} Updated workflow document
   */
  async updateWorkflow(id, updateData) {
    // Verify existence first
    const existing = await this.repo.findWorkflowById(id);
    if (!existing) {
      throw new ApiError(404, `Cannot update non-existent workflow with ID "${id}".`);
    }

    // Validate the complete graph when nodes or edges are being updated.
    if (updateData.nodes !== undefined || updateData.edges !== undefined) {
      const mergedNodes =
        updateData.nodes !== undefined ? updateData.nodes : existing.nodes;

      const mergedEdges =
        updateData.edges !== undefined ? updateData.edges : existing.edges;

      const graphValidation = validateWorkflowGraph(mergedNodes, mergedEdges);

      if (!graphValidation.isValid) {
        throw new ApiError(
          400,
          'Workflow update validation failed.',
          graphValidation.errors
        );
      }
    }

    const updated = await this.repo.updateWorkflowById(id, updateData);
    logger.info(
      `Updated workflow "${updated.name}" (ID: ${updated.id}, v${updated.version}, nodes: ${updated.nodes?.length || 0})`
    );
    return updated;
  }

  /**
   * Deletes a workflow by its ID.
   *
   * @param {string} id
   * @throws {ApiError} 404 if workflow does not exist
   * @returns {Promise<{ id: string, deleted: boolean }>}
   */
  async deleteWorkflow(id) {
    const existing = await this.repo.findWorkflowById(id);
    if (!existing) {
      throw new ApiError(404, `Cannot delete non-existent workflow with ID "${id}".`);
    }

    const success = await this.repo.deleteWorkflowById(id);
    logger.info(`Deleted workflow ID: ${id}`);
    return { id, deleted: success };
  }
}

export const workflowService = new WorkflowService();
export default workflowService;
