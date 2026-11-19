import { Router } from 'express';
import {
  createWorkflow,
  getWorkflowById,
  listWorkflows,
  updateWorkflow,
  deleteWorkflow,
  validateWorkflowGraph,
  validateSavedWorkflow,
} from '../controllers/workflow.controller.js';
import {
  validateCreateWorkflow,
  validateUpdateWorkflow,
  validateWorkflowId,
} from '../validators/workflow.validator.js';

const router = Router();

// POST /api/workflows/validate - Validate an ad-hoc workflow graph payload
router.post('/validate', validateWorkflowGraph);

// POST /api/workflows - Create a new workflow graph
router.post('/', validateCreateWorkflow, createWorkflow);

// GET /api/workflows - List workflows with optional filtering
router.get('/', listWorkflows);

// GET /api/workflows/:id/validate - Validate a saved workflow graph from DB
router.get('/:id/validate', validateWorkflowId, validateSavedWorkflow);

// GET /api/workflows/:id - Retrieve workflow by ID
router.get('/:id', validateWorkflowId, getWorkflowById);

// PUT /api/workflows/:id - Update existing workflow graph
router.put('/:id', validateWorkflowId, validateUpdateWorkflow, updateWorkflow);

// DELETE /api/workflows/:id - Delete workflow by ID
router.delete('/:id', validateWorkflowId, deleteWorkflow);

export default router;
