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
 * Ingest multiple telemetry records in bulk with partial failure resilience.
 * POST /api/telemetry/bulk
 */
export const createBulkTelemetry = asyncHandler(async (req, res) => {
  const payload = req.bulkPayload || {
    validRecords: (Array.isArray(req.body) ? req.body : req.body?.records || []).map((r, i) => ({
      originalIndex: i,
      record: r,
    })),
    rejectedRecords: [],
    total: Array.isArray(req.body) ? req.body.length : req.body?.records?.length || 0,
  };

  const result = await telemetryService.ingestBulkTelemetry(payload);

  // If partial success (some succeeded, some failed), return 207 Multi-Status
  if (result.isPartial) {
    return ApiResponse.success(
      res,
      result,
      `Bulk telemetry partially ingested: ${result.insertedCount} succeeded, ${result.failedCount} rejected`,
      207
    );
  }

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

/**
 * Retrieve operational telemetry ingestion metrics.
 * GET /api/telemetry/metrics
 */
export const getTelemetryMetrics = asyncHandler(async (req, res) => {
  const snapshot = telemetryService.getMetrics();
  return ApiResponse.success(res, snapshot, 'Telemetry ingestion metrics retrieved successfully');
});

export default {
  createTelemetry,
  createBulkTelemetry,
  getTelemetryBySensor,
  getLatestTelemetry,
  getTelemetryMetrics,
};
