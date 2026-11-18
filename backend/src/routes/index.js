import { Router } from 'express';
import healthRoutes from './health.routes.js';
import telemetryRoutes from './telemetry.routes.js';
import { ApiResponse } from '../utils/apiResponse.js';
import workflowRoutes from './workflow.routes.js';
import executionHistoryRoutes from './executionHistory.routes.js';

const router = Router();

// Mount health check routes: /api/health
router.use('/health', healthRoutes);

// Mount telemetry ingestion and query routes: /api/telemetry
router.use('/telemetry', telemetryRoutes);

// Mount workflow routes: /api/workflow
router.use('/workflows', workflowRoutes);

// Mount execution history routes: /api/execution-history
router.use('/execution-history', executionHistoryRoutes);

// Root API endpoint: /api
router.get('/', (req, res) => {
  ApiResponse.success(
    res,
    {
      name: 'NexusFlow API',
      version: '0.1.0',
      docs: '/api/docs',
      health: '/api/health',
      endpoints: {
        health: 'GET /api/health',
        ingestTelemetry: 'POST /api/telemetry',
        ingestTelemetryBulk: 'POST /api/telemetry/bulk',
        getTelemetryBySensor: 'GET /api/telemetry/:sensorId',
        getLatestTelemetry: 'GET /api/telemetry/:sensorId/latest',
        createWorkflow: 'POST /api/workflows',
        getWorkflows: 'GET /api/workflows',
        getWorkflow: 'GET /api/workflows/:id',
        updateWorkflow: 'PUT /api/workflows/:id',
        deleteWorkflow: 'DELETE /api/workflows/:id',
        getWorkflowById: 'GET /api/workflows/:id',
        listWorkflows: 'GET /api/workflows',
      },
    },
    'Welcome to NexusFlow API'
  );
});

export default router;
