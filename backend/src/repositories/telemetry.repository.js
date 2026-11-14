import {
  telemetryContract,
  normalizeTelemetry,
  getSensorQueryKey,
} from '../config/database.contract.js';
import { getCollection } from '../config/db.js';
import { ApiError } from '../utils/apiError.js';

/**
 * Telemetry Repository
 *
 * Interfaces with the MongoDB Time-Series telemetry collection according
 * to the agreed Integration Contract without modifying or recreating the collection.
 */
export class TelemetryRepository {
  /**
   * @param {Object} [options={}]
   * @param {typeof telemetryContract} [options.contract] - Custom schema contract
   * @param {import('mongodb').Collection} [options.collection] - Injected collection (test double)
   */
  constructor(options = {}) {
    this.contract = options.contract || telemetryContract;
    this._collection = options.collection || null;
  }

  /**
   * Sets or overrides the active collection instance (useful for test doubles).
   * @param {import('mongodb').Collection | null} collection
   */
  setCollection(collection) {
    this._collection = collection;
  }

  /**
   * Resets injected collection back to default database connection.
   */
  resetCollection() {
    this._collection = null;
  }

  /**
   * Retrieves the MongoDB collection instance.
   * Throws 503 if database connection is unavailable.
   * @returns {import('mongodb').Collection}
   */
  getCollection() {
    if (this._collection) {
      return this._collection;
    }
    return getCollection(this.contract.collectionName);
  }

  /**
   * Inserts a single telemetry document conforming to the schema contract.
   *
   * @param {Object} data - Raw or semi-formatted telemetry data
   * @returns {Promise<Object>} Inserted document with _id
   */
  async insertTelemetry(data) {
    try {
      const document = normalizeTelemetry(data, this.contract);
      const collection = this.getCollection();
      const result = await collection.insertOne(document);
      return {
        _id: result.insertedId,
        ...document,
      };
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(500, `Failed to insert telemetry: ${err.message}`);
    }
  }

  /**
   * Inserts multiple telemetry records into the Time-Series collection in a single batch.
   *
   * @param {Array<Object>} records - Array of raw telemetry objects
   * @returns {Promise<{ insertedCount: number, insertedIds: Record<number, any>, documents: Array<Object> }>}
   */
  async insertManyTelemetry(records) {
    if (!Array.isArray(records) || records.length === 0) {
      throw new ApiError(400, 'records must be a non-empty array.');
    }

    try {
      const documents = records.map((record) =>
        normalizeTelemetry(record, this.contract)
      );
      const collection = this.getCollection();
      const result = await collection.insertMany(documents, { ordered: false });
      return {
        insertedCount: result.insertedCount,
        insertedIds: result.insertedIds,
        documents,
      };
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(500, `Failed to insert telemetry batch: ${err.message}`);
    }
  }

  /**
   * Finds telemetry documents for a specific sensor.
   * Supports time-range filtering, sorting, and pagination.
   *
   * @param {string} sensorId - Sensor identifier
   * @param {Object} [options={}]
   * @param {Date|string|number} [options.startTime] - Inclusive start timestamp
   * @param {Date|string|number} [options.endTime] - Inclusive end timestamp
   * @param {number} [options.limit=100] - Maximum documents to return (max 1000)
   * @param {number} [options.skip=0] - Documents to skip
   * @param {Record<string, 1|-1>} [options.sort] - Sort order (defaults to latest first)
   * @returns {Promise<Array<Object>>}
   */
  async findTelemetryBySensor(sensorId, options = {}) {
    if (!sensorId || typeof sensorId !== 'string' || sensorId.trim() === '') {
      throw new ApiError(400, 'sensorId must be a non-empty string.');
    }

    const sensorKey = getSensorQueryKey(this.contract);
    const query = { [sensorKey]: sensorId.trim() };

    // Range filtering on timeField
    const timeFilter = {};
    if (options.startTime) {
      const start = new Date(options.startTime);
      if (!isNaN(start.getTime())) {
        timeFilter.$gte = start;
      }
    }
    if (options.endTime) {
      const end = new Date(options.endTime);
      if (!isNaN(end.getTime())) {
        timeFilter.$lte = end;
      }
    }
    if (Object.keys(timeFilter).length > 0) {
      query[this.contract.timeField] = timeFilter;
    }

    const limit = Math.max(1, Math.min(1000, parseInt(options.limit, 10) || 100));
    const skip = Math.max(0, parseInt(options.skip, 10) || 0);
    const sort = options.sort || { [this.contract.timeField]: -1 };

    try {
      const collection = this.getCollection();
      return await collection.find(query).sort(sort).skip(skip).limit(limit).toArray();
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(500, `Failed to query telemetry by sensor: ${err.message}`);
    }
  }

  /**
   * Retrieves the single most recent telemetry record for a given sensor.
   *
   * @param {string} sensorId - Sensor identifier
   * @returns {Promise<Object|null>} Latest document or null if none found
   */
  async getLatestTelemetry(sensorId) {
    if (!sensorId || typeof sensorId !== 'string' || sensorId.trim() === '') {
      throw new ApiError(400, 'sensorId must be a non-empty string.');
    }

    const sensorKey = getSensorQueryKey(this.contract);
    const sort = { [this.contract.timeField]: -1 };

    try {
      const collection = this.getCollection();
      return await collection.findOne({ [sensorKey]: sensorId.trim() }, { sort });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(500, `Failed to get latest telemetry: ${err.message}`);
    }
  }
}

export const telemetryRepository = new TelemetryRepository();
export default telemetryRepository;
