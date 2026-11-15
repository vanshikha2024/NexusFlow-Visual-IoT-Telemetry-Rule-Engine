import { env } from '../config/env.js';
import { ApiError } from '../utils/apiError.js';

/**
 * Validates a single telemetry item object.
 * @param {any} item - The telemetry record to validate
 * @param {number} [index] - Optional index when validating inside a batch
 * @returns {{ isValid: boolean, errors: Array<{ field: string, message: string }>, sensorId?: string }}
 */
export const validateTelemetryRecord = (item, index = null) => {
  const errors = [];
  const prefix = index !== null ? `records[${index}].` : '';

  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return {
      isValid: false,
      errors: [
        {
          field: index !== null ? `records[${index}]` : 'body',
          message: `${prefix}Telemetry record must be a non-null JSON object.`,
        },
      ],
      sensorId: null,
    };
  }

  // 1. Validate sensorId (required, non-empty string)
  const sensorId =
    item.metadata?.sensorId ||
    item.sensorId ||
    item.deviceId ||
    item.id;

  if (!sensorId || typeof sensorId !== 'string' || sensorId.trim() === '') {
    errors.push({
      field: `${prefix}sensorId`,
      message: `${prefix}sensorId is required and must be a non-empty string.`,
    });
  }

  // 2. Validate value (numeric measurement required)
  const val = item.value !== undefined ? item.value : item.reading;
  if (val === undefined || val === null) {
    errors.push({
      field: `${prefix}value`,
      message: `${prefix}value is required and must be a valid number.`,
    });
  } else if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) {
    errors.push({
      field: `${prefix}value`,
      message: `${prefix}value must be a valid finite number. Received: ${val}`,
    });
  }

  // 3. Validate timestamp if provided
  const rawTime = item.timestamp || item.time || item.createdAt;
  if (rawTime !== undefined && rawTime !== null) {
    const parsed = new Date(rawTime);
    if (isNaN(parsed.getTime())) {
      errors.push({
        field: `${prefix}timestamp`,
        message: `${prefix}timestamp must be a valid ISO 8601 date, timestamp, or Date object. Received: ${rawTime}`,
      });
    }
  }

  // 4. Validate metadata if provided
  if (item.metadata !== undefined && item.metadata !== null) {
    if (typeof item.metadata !== 'object' || Array.isArray(item.metadata)) {
      errors.push({
        field: `${prefix}metadata`,
        message: `${prefix}metadata must be an object.`,
      });
    }
  }

  // 5. Validate unit if provided
  if (item.unit !== undefined && item.unit !== null && typeof item.unit !== 'string') {
    errors.push({
      field: `${prefix}unit`,
      message: `${prefix}unit must be a string.`,
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    sensorId: typeof sensorId === 'string' ? sensorId.trim() : null,
  };
};

/**
 * Express middleware for validating single telemetry record in POST /api/telemetry
 */
export const validateTelemetry = (req, res, next) => {
  if (
    !req.body ||
    typeof req.body !== 'object' ||
    Array.isArray(req.body) ||
    Object.keys(req.body).length === 0
  ) {
    return next(
      new ApiError(400, 'Request body must be a non-empty JSON object.', [
        { field: 'body', message: 'Request body must be a non-empty JSON object.' },
      ])
    );
  }

  const { isValid, errors } = validateTelemetryRecord(req.body);
  if (!isValid) {
    return next(new ApiError(400, 'Telemetry validation failed.', errors));
  }

  next();
};

/**
 * Express middleware for validating bulk telemetry records in POST /api/telemetry/bulk
 * Supports safe partial failure handling and enforces batch size limits.
 */
export const validateTelemetryBulk = (req, res, next) => {
  if (!req.body) {
    return next(
      new ApiError(400, 'Request body must not be empty.', [
        { field: 'body', message: 'Request body is required.' },
      ])
    );
  }

  // Support both raw array `[ ... ]` and wrapped `{ records: [ ... ] }`
  let records = null;
  if (Array.isArray(req.body)) {
    records = req.body;
  } else if (typeof req.body === 'object') {
    if (Array.isArray(req.body.records)) {
      records = req.body.records;
    } else if (Array.isArray(req.body.telemetry)) {
      records = req.body.telemetry;
    } else if (Array.isArray(req.body.data)) {
      records = req.body.data;
    }
  }

  // Check if non-empty array
  if (!records || !Array.isArray(records) || records.length === 0) {
    return next(
      new ApiError(
        400,
        'Request body must be a non-empty array or an object containing a non-empty "records" array.',
        [
          {
            field: 'records',
            message: 'Provide a non-empty array of telemetry objects.',
          },
        ]
      )
    );
  }

  // Enforce batch size limit (prevent unbounded memory spikes)
  if (records.length > env.MAX_BATCH_SIZE) {
    return next(
      new ApiError(
        413,
        `Batch size of ${records.length} exceeds maximum allowed limit of ${env.MAX_BATCH_SIZE} records.`,
        [
          {
            field: 'records',
            message: `Batch contains ${records.length} records. Maximum allowed is ${env.MAX_BATCH_SIZE}.`,
          },
        ]
      )
    );
  }

  // Validate each record individually to support partial failure isolation
  const validRecords = [];
  const rejectedRecords = [];

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const { isValid, errors, sensorId } = validateTelemetryRecord(record, i);

    if (isValid) {
      validRecords.push({ originalIndex: i, record });
    } else {
      rejectedRecords.push({
        index: i,
        sensorId,
        errors,
      });
    }
  }

  // Strict all-or-nothing mode if requested via query or header
  const isAllOrNone =
    req.query.allOrNone === 'true' ||
    req.headers['x-all-or-none'] === 'true';

  if (isAllOrNone && rejectedRecords.length > 0) {
    const flatErrors = rejectedRecords.flatMap((r) => r.errors);
    return next(
      new ApiError(
        400,
        `All-or-nothing bulk validation failed (${flatErrors.length} errors across batch).`,
        flatErrors
      )
    );
  }

  // If every record in the batch failed validation, reject completely with 400
  if (validRecords.length === 0) {
    const flatErrors = rejectedRecords.flatMap((r) => r.errors);
    return next(
      new ApiError(
        400,
        `Bulk telemetry validation failed: all ${records.length} records are invalid.`,
        flatErrors
      )
    );
  }

  // Attach partitioned payload for safe partial ingestion
  req.bulkPayload = {
    validRecords,
    rejectedRecords,
    total: records.length,
  };

  next();
};

export default {
  validateTelemetryRecord,
  validateTelemetry,
  validateTelemetryBulk,
};
