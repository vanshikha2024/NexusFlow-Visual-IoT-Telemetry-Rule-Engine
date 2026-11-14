import { Router } from 'express';
import healthRoutes from './health.routes.js';
import telemetryRoutes from './telemetry.routes.js';
import { ApiResponse } from '../utils/apiResponse.js';

const router = Router();

// Mount health check routes: /api/health
router.use('/health', healthRoutes);

// Mount telemetry ingestion and query routes: /api/telemetry
router.use('/telemetry', telemetryRoutes);

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
      },
    },
    'Welcome to NexusFlow API'
  );
});

export default router;
