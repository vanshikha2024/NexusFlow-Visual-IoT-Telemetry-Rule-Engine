import { Router } from 'express';
import {
  createTelemetry,
  createBulkTelemetry,
  getTelemetryBySensor,
  getLatestTelemetry,
  getTelemetryMetrics,
} from '../controllers/telemetry.controller.js';
import {
  validateTelemetry,
  validateTelemetryBulk,
} from '../validators/telemetry.validator.js';

const router = Router();

// Ingest single telemetry record
// POST /api/telemetry
router.post('/', validateTelemetry, createTelemetry);

// Ingest batch of telemetry records (with partial failure handling & limits)
// POST /api/telemetry/bulk
router.post('/bulk', validateTelemetryBulk, createBulkTelemetry);

// Ingestion operational metrics
// GET /api/telemetry/metrics (Placed before /:sensorId to prevent route conflict)
router.get('/metrics', getTelemetryMetrics);

// Query telemetry records by sensorId
// GET /api/telemetry/:sensorId
router.get('/:sensorId', getTelemetryBySensor);

// Query latest telemetry record for sensorId
// GET /api/telemetry/:sensorId/latest
router.get('/:sensorId/latest', getLatestTelemetry);

export default router;
