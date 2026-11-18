import { Router } from 'express';
import {
  createWorkflow,
  getWorkflowById,
  listWorkflows,
  updateWorkflow,
  deleteWorkflow,
  executeWorkflow,
} from '../controllers/workflow.controller.js';
import {
  validateCreateWorkflow,
  validateUpdateWorkflow,
  validateWorkflowId,
} from '../validators/workflow.validator.js';

const router = Router();

// POST /api/workflows - Create a new workflow graph
router.post('/', validateCreateWorkflow, createWorkflow);

// GET /api/workflows - List workflows with optional filtering
router.get('/', listWorkflows);

// GET /api/workflows/:id - Retrieve workflow by ID
router.get('/:id', validateWorkflowId, getWorkflowById);

// PUT /api/workflows/:id - Update existing workflow graph
router.put('/:id', validateWorkflowId, validateUpdateWorkflow, updateWorkflow);

// DELETE /api/workflows/:id - Delete workflow by ID
router.delete('/:id', validateWorkflowId, deleteWorkflow);

// POST /api/workflows/:id/execute - Execute workflow in simulation mode
router.post('/:id/execute', validateWorkflowId, executeWorkflow);

export default router;
