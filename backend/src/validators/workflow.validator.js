import { ApiError } from '../utils/apiError.js';

const ALLOWED_STATUSES = new Set(['draft', 'active', 'paused', 'completed', 'archived']);

/**
 * Validates individual nodes and edges inside a workflow graph payload.
 *
 * @param {Array<any>} nodes
 * @param {Array<any>} [edges=[]]
 * @returns {{ isValid: boolean, errors: Array<{ field: string, message: string }> }}
 */
export const validateGraph = (nodes, edges = []) => {
  const errors = [];

  // 1. Validate Nodes Array
  if (!Array.isArray(nodes)) {
    errors.push({
      field: 'nodes',
      message: 'Workflow "nodes" must be an array.',
    });
    return { isValid: false, errors };
  }

  if (nodes.length === 0) {
    errors.push({
      field: 'nodes',
      message: 'Workflow must contain at least one node.',
    });
    return { isValid: false, errors };
  }

  const nodeIds = new Set();

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const prefix = `nodes[${i}]`;

    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      errors.push({
        field: prefix,
        message: `${prefix} must be a valid JSON object.`,
      });
      continue;
    }

    // Node ID
    if (!node.id || typeof node.id !== 'string' || node.id.trim() === '') {
      errors.push({
        field: `${prefix}.id`,
        message: `${prefix}.id is required and must be a non-empty string.`,
      });
    } else {
      const cleanId = node.id.trim();
      if (nodeIds.has(cleanId)) {
        errors.push({
          field: `${prefix}.id`,
          message: `Duplicate node ID "${cleanId}" at ${prefix}. Node IDs must be unique within the workflow.`,
        });
      }
      nodeIds.add(cleanId);
    }

    // Node Type Identifier
    if (!node.type || typeof node.type !== 'string' || node.type.trim() === '') {
      errors.push({
        field: `${prefix}.type`,
        message: `${prefix}.type is required and must be a non-empty string.`,
      });
    }

    // Position (optional, but if present must be {x: number, y: number})
    if (node.position !== undefined && node.position !== null) {
      if (typeof node.position !== 'object' || Array.isArray(node.position)) {
        errors.push({
          field: `${prefix}.position`,
          message: `${prefix}.position must be an object with numeric x and y coordinates.`,
        });
      } else {
        if (
          !Number.isFinite(node.position.x) ||
	        !Number.isFinite(node.position.y)
        ) {
          errors.push({
            field: `${prefix}.position`,
            message: `${prefix}.position coordinates { x, y } must be valid numbers.`,
          });
        }
      }
    }

    // Data / Config objects (optional, but if present must be objects)
    if (node.data !== undefined && node.data !== null) {
      if (typeof node.data !== 'object' || Array.isArray(node.data)) {
        errors.push({
          field: `${prefix}.data`,
          message: `${prefix}.data must be an object.`,
        });
      }
    }

    if (node.config !== undefined && node.config !== null) {
      if (typeof node.config !== 'object' || Array.isArray(node.config)) {
        errors.push({
          field: `${prefix}.config`,
          message: `${prefix}.config must be an object.`,
        });
      }
    }
  }

  // 2. Validate Edges Array
  if (edges !== undefined && edges !== null) {
    if (!Array.isArray(edges)) {
      errors.push({
        field: 'edges',
        message: 'Workflow "edges" must be an array.',
      });
      return { isValid: false, errors };
    }

    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      const prefix = `edges[${i}]`;

      if (!edge || typeof edge !== 'object' || Array.isArray(edge)) {
        errors.push({
          field: prefix,
          message: `${prefix} must be a valid JSON object.`,
        });
        continue;
      }

      // Edge Source
      if (!edge.source || typeof edge.source !== 'string' || edge.source.trim() === '') {
        errors.push({
          field: `${prefix}.source`,
          message: `${prefix}.source is required and must be a non-empty string.`,
        });
      } else if (!nodeIds.has(edge.source.trim())) {
        errors.push({
          field: `${prefix}.source`,
          message: `Dangling edge at ${prefix}: source node "${edge.source}" does not exist in nodes list.`,
        });
      }

      // Edge Target
      if (!edge.target || typeof edge.target !== 'string' || edge.target.trim() === '') {
        errors.push({
          field: `${prefix}.target`,
          message: `${prefix}.target is required and must be a non-empty string.`,
        });
      } else if (!nodeIds.has(edge.target.trim())) {
        errors.push({
          field: `${prefix}.target`,
          message: `Dangling edge at ${prefix}: target node "${edge.target}" does not exist in nodes list.`,
        });
      }

      // Self-loop check
      if (
        edge.source &&
        edge.target &&
        typeof edge.source === 'string' &&
        typeof edge.target === 'string' &&
        edge.source.trim() === edge.target.trim()
      ) {
        errors.push({
          field: prefix,
          message: `Invalid self-connecting loop at ${prefix}: node "${edge.source.trim()}" connects to itself.`,
        });
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Middleware: Validates workflow payload for creation (POST /api/workflows).
 */
export const validateCreateWorkflow = (req, res, next) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return next(
      new ApiError(400, 'Request body must be a non-empty JSON object.', [
        { field: 'body', message: 'Request body must be a non-empty JSON object.' },
      ])
    );
  }

  const errors = [];
  const { name, description, status, nodes, edges } = req.body;

  // Name validation
  if (!name || typeof name !== 'string' || name.trim() === '') {
    errors.push({
      field: 'name',
      message: 'Workflow "name" is required and must be a non-empty string.',
    });
  } else if (name.trim().length > 120) {
    errors.push({
      field: 'name',
      message: 'Workflow "name" cannot exceed 120 characters.',
    });
  }

  // Description validation
  if (description !== undefined && description !== null) {
    if (typeof description !== 'string') {
      errors.push({
        field: 'description',
        message: 'Workflow "description" must be a string.',
      });
    } else if (description.length > 500) {
      errors.push({
        field: 'description',
        message: 'Workflow "description" cannot exceed 500 characters.',
      });
    }
  }

  // Status validation
  if (status !== undefined && status !== null) {
    if (typeof status !== 'string' || !ALLOWED_STATUSES.has(status.toLowerCase())) {
      errors.push({
        field: 'status',
        message: `Workflow "status" must be one of: ${Array.from(ALLOWED_STATUSES).join(', ')}.`,
      });
    }
  }
if (typeof status === 'string' && ALLOWED_STATUSES.has(status.toLowerCase())) {
  req.body.status = status.toLowerCase();
}

  // Graph nodes & edges validation
  const graphValidation = validateGraph(nodes, edges || []);
  if (!graphValidation.isValid) {
    errors.push(...graphValidation.errors);
  }

  if (errors.length > 0) {
    return next(new ApiError(400, 'Workflow validation failed.', errors));
  }

  next();
};

/**
 * Middleware: Validates workflow payload for update (PUT /api/workflows/:id).
 */
export const validateUpdateWorkflow = (req, res, next) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return next(
      new ApiError(400, 'Request body must be a non-empty JSON object.', [
        { field: 'body', message: 'Request body must be a non-empty JSON object.' },
      ])
    );
  }

  const errors = [];
  const { name, description, status, nodes, edges } = req.body;

  // If name is provided, validate it
  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim() === '') {
      errors.push({
        field: 'name',
        message: 'Workflow "name" cannot be empty when provided.',
      });
    } else if (name.trim().length > 120) {
      errors.push({
        field: 'name',
        message: 'Workflow "name" cannot exceed 120 characters.',
      });
    }
  }

  // If description is provided, validate it
  if (description !== undefined && description !== null) {
    if (typeof description !== 'string') {
      errors.push({
        field: 'description',
        message: 'Workflow "description" must be a string.',
      });
    } else if (description.length > 500) {
      errors.push({
        field: 'description',
        message: 'Workflow "description" cannot exceed 500 characters.',
      });
    }
  }

  // If status is provided, validate it
  if (status !== undefined && status !== null) {
    if (typeof status !== 'string' || !ALLOWED_STATUSES.has(status.toLowerCase())) {
      errors.push({
        field: 'status',
        message: `Workflow "status" must be one of: ${Array.from(ALLOWED_STATUSES).join(', ')}.`,
      });
    }
  }

  if (typeof status === 'string' && ALLOWED_STATUSES.has(status.toLowerCase())) {
    req.body.status = status.toLowerCase();
  }
  // If nodes are provided, validate graph
  if (nodes !== undefined) {
    const graphValidation = validateGraph(nodes, edges || []);
    if (!graphValidation.isValid) {
      errors.push(...graphValidation.errors);
    }
  }

  if (errors.length > 0) {
    return next(new ApiError(400, 'Workflow update validation failed.', errors));
  }

  next();
};

/**
 * Middleware: Validates workflow ID route parameter.
 */
export const validateWorkflowId = (req, res, next) => {
  const { id } = req.params;
  if (!id || typeof id !== 'string' || id.trim() === '') {
    return next(new ApiError(400, 'Invalid or missing workflow ID parameter.'));
  }
  req.params.id = id.trim();
  next();
};

export default {
  validateGraph,
  validateCreateWorkflow,
  validateUpdateWorkflow,
  validateWorkflowId,
};
