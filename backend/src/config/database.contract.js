import { env } from './env.js';

/**
 * MongoDB Time-Series Telemetry Integration Contract
 *
 * Defines the contract agreed upon for MongoDB Time-Series telemetry storage.
 * If teammate Rishi modifies or customizes field naming, these values can be adjusted
 * via environment variables without requiring code changes in the repository.
 */
export const telemetryContract = Object.freeze({
  /** Target MongoDB database name */
  databaseName: process.env.DB_NAME || 'nexusflow',

  /** Time-series collection name */
  collectionName: process.env.TELEMETRY_COLLECTION || 'telemetry',

  /**
   * Field containing date/time in each document.
   * Required by MongoDB Time-Series collections; must be a BSON Date.
   */
  timeField: process.env.TELEMETRY_TIME_FIELD || 'timestamp',

  /**
   * Field containing metadata in each document (used by MongoDB to bucket streams).
   */
  metaField: process.env.TELEMETRY_META_FIELD || 'metadata',

  /** Key inside metaField used to identify the sensor / device */
  sensorIdKey: process.env.TELEMETRY_SENSOR_ID_KEY || 'sensorId',

  /** Expected collection granularity */
  granularity: process.env.TELEMETRY_GRANULARITY || 'seconds',
});

/**
 * Returns the MongoDB query filter path for sensor identification based on the contract.
 * @param {typeof telemetryContract} [contract=telemetryContract]
 * @returns {string} e.g. "metadata.sensorId"
 */
export const getSensorQueryKey = (contract = telemetryContract) => {
  if (contract.metaField) {
    return `${contract.metaField}.${contract.sensorIdKey}`;
  }
  return contract.sensorIdKey;
};

/**
 * Normalizes and validates incoming telemetry data according to the schema contract.
 * Ensures the timestamp is a valid Date instance and metadata holds the sensorId.
 *
 * @param {Object} input - Raw telemetry payload
 * @param {typeof telemetryContract} [contract=telemetryContract]
 * @returns {Object} Normalized MongoDB document
 */
export const normalizeTelemetry = (input, contract = telemetryContract) => {
  if (!input || typeof input !== 'object') {
    throw new Error('Telemetry record must be a valid non-null object.');
  }

  // 1. Resolve Sensor ID
  const sensorId =
    input[contract.metaField]?.[contract.sensorIdKey] ||
    input[contract.sensorIdKey] ||
    input.sensorId ||
    input.deviceId;

  if (!sensorId || typeof sensorId !== 'string' || sensorId.trim() === '') {
    throw new Error(
      `Telemetry record missing required sensor identifier ('${contract.sensorIdKey}').`
    );
  }

  // 2. Resolve Timestamp (BSON Date)
  const rawTime =
    input[contract.timeField] ||
    input.timestamp ||
    input.time ||
    input.createdAt;

  let timestamp;
  if (!rawTime) {
    timestamp = new Date();
  } else if (rawTime instanceof Date) {
    if (isNaN(rawTime.getTime())) {
      throw new Error(`Invalid Date provided in '${contract.timeField}'.`);
    }
    timestamp = rawTime;
  } else {
    timestamp = new Date(rawTime);
    if (isNaN(timestamp.getTime())) {
      throw new Error(
        `Unable to parse '${contract.timeField}' into a valid Date: ${rawTime}`
      );
    }
  }

  // 3. Assemble Metadata
  const existingMeta =
    typeof input[contract.metaField] === 'object' && input[contract.metaField] !== null
      ? input[contract.metaField]
      : {};

  const metadata = {
    ...existingMeta,
    [contract.sensorIdKey]: sensorId.trim(),
    ...(input.sensorType ? { sensorType: input.sensorType } : {}),
    ...(input.location ? { location: input.location } : {}),
  };

  // 4. Extract Measurements / Payload fields (exclude timeField, metaField, sensorIdKey)
  const reservedKeys = new Set([
    contract.timeField,
    contract.metaField,
    contract.sensorIdKey,
    'sensorId',
    'deviceId',
    'timestamp',
    'time',
    'sensorType',
    'location',
  ]);

  const measurements = {};
  for (const [key, val] of Object.entries(input)) {
    if (!reservedKeys.has(key)) {
      measurements[key] = val;
    }
  }

  // Support direct 'value' or 'reading' if present
  if (input.value !== undefined) {
    measurements.value = input.value;
  }
  if (input.unit !== undefined) {
    measurements.unit = input.unit;
  }

  // 5. Construct standardized document
  return {
    [contract.timeField]: timestamp,
    [contract.metaField]: metadata,
    ...measurements,
  };
};

export default {
  telemetryContract,
  getSensorQueryKey,
  normalizeTelemetry,
};
