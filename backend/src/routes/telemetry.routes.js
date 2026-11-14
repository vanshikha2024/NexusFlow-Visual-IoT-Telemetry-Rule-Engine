import { Router } from 'express';
import {
  createTelemetry,
  createBulkTelemetry,
  getTelemetryBySensor,
  getLatestTelemetry,
} from '../controllers/telemetry.controller.js';
import {
  validateTelemetry,
  validateTelemetryBulk,
} from '../validators/telemetry.validator.js';

const router = Router();

// Ingest single telemetry record
// POST /api/telemetry
router.post('/', validateTelemetry, createTelemetry);

// Ingest batch of telemetry records
// POST /api/telemetry/bulk
router.post('/bulk', validateTelemetryBulk, createBulkTelemetry);

// Query telemetry records by sensorId
// GET /api/telemetry/:sensorId
router.get('/:sensorId', getTelemetryBySensor);

// Query latest telemetry record for sensorId
// GET /api/telemetry/:sensorId/latest
router.get('/:sensorId/latest', getLatestTelemetry);

export default router;
