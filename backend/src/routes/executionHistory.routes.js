
import { Router } from "express";
import {
  getRecentHistory,
  getExecutionById,
  getWorkflowHistory,
} from "../controllers/executionHistory.controller.js";

const router = Router();

// Get recent executions
router.get("/", getRecentHistory);

// Get history for a specific workflow
router.get("/workflow/:workflowId", getWorkflowHistory);

// Get one execution by ID
router.get("/:id", getExecutionById);

export default router;

