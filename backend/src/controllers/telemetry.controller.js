import { telemetryService } from '../services/telemetry.service.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Ingest a single telemetry record.
 * POST /api/telemetry
 */
export const createTelemetry = asyncHandler(async (req, res) => {
  const result = await telemetryService.ingestTelemetry(req.body);
  return ApiResponse.success(
    res,
    result,
    'Telemetry record ingested successfully',
    201
  );
});

/**
 * Ingest multiple telemetry records in bulk.
 * POST /api/telemetry/bulk
 */
export const createBulkTelemetry = asyncHandler(async (req, res) => {
  const records = req.validatedRecords || (Array.isArray(req.body) ? req.body : req.body?.records);
  const result = await telemetryService.ingestBulkTelemetry(records);
  return ApiResponse.success(
    res,
    result,
    'Bulk telemetry ingested successfully',
    201
  );
});

/**
 * Retrieve telemetry history for a specific sensor.
 * GET /api/telemetry/:sensorId
 */
export const getTelemetryBySensor = asyncHandler(async (req, res) => {
  const { sensorId } = req.params;
  const { startTime, endTime, limit, skip } = req.query;

  const records = await telemetryService.getTelemetryBySensor(sensorId, {
    startTime,
    endTime,
    limit,
    skip,
  });

  return ApiResponse.success(
    res,
    records,
    `Retrieved ${records.length} telemetry records for sensor "${sensorId}"`
  );
});

/**
 * Retrieve the latest telemetry record for a specific sensor.
 * GET /api/telemetry/:sensorId/latest
 */
export const getLatestTelemetry = asyncHandler(async (req, res) => {
  const { sensorId } = req.params;
  const record = await telemetryService.getLatestTelemetry(sensorId);

  if (!record) {
    throw new ApiError(404, `No telemetry records found for sensor "${sensorId}".`);
  }

  return ApiResponse.success(
    res,
    record,
    `Latest telemetry retrieved for sensor "${sensorId}"`
  );
});

export default {
  createTelemetry,
  createBulkTelemetry,
  getTelemetryBySensor,
  getLatestTelemetry,
};
