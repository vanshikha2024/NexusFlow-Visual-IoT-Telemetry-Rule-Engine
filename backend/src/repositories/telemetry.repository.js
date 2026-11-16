import {
  telemetryContract,
  normalizeTelemetry,
  getSensorQueryKey,
} from '../config/database.contract.js';
import { getCollection } from '../config/db.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/apiError.js';
import { chunkArray, yieldToEventLoop } from '../utils/asyncChunk.js';
import { metrics } from '../utils/metrics.js';
import { logger } from '../utils/logger.js';

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
      if (err.statusCode === 503 || err.name === 'MongoServerSelectionError' || err.name === 'MongoNetworkError') {
        metrics.recordDbError();
        throw new ApiError(503, 'Database service unavailable. Please retry later.');
      }
      if (err instanceof ApiError) throw err;
      throw new ApiError(500, `Failed to insert telemetry: ${err.message}`);
    }
  }

  /**
   * Inserts multiple telemetry records into the Time-Series collection.
   * Processes in non-blocking chunks and handles partial write failures safely.
   *
   * @param {Array<Object>} records - Array of raw telemetry objects
   * @returns {Promise<{ insertedCount: number, insertedIds: Record<number, any>, documents: Array<Object>, writeErrors: Array<Object> }>}
   */
  async insertManyTelemetry(records) {
    if (!Array.isArray(records) || records.length === 0) {
      throw new ApiError(400, 'records must be a non-empty array.');
    }

    let collection;
    try {
      collection = this.getCollection();
    } catch (err) {
      metrics.recordDbError();
      throw err;
    }

    const documents = records.map((record) =>
      normalizeTelemetry(record, this.contract)
    );

    // Chunking to avoid blocking the event loop on large batches
    const chunkSize = env.INGESTION_CHUNK_SIZE || 250;

    // Fast-path: single chunk batch avoids multi-chunk slicing and ID mapping overhead
    if (documents.length <= chunkSize) {
      try {
        const result = await collection.insertMany(documents, { ordered: false });
        return {
          insertedCount: result.insertedCount !== undefined ? result.insertedCount : documents.length,
          insertedIds: result.insertedIds || {},
          documents,
          writeErrors: [],
        };
      } catch (err) {
        if (err.name === 'MongoBulkWriteError' || err.writeErrors) {
          const insertedFromError = err.result?.insertedCount || 0;
          const writeErrors = [];
          if (Array.isArray(err.writeErrors)) {
            for (const wErr of err.writeErrors) {
              writeErrors.push({
                index: wErr.index,
                code: wErr.code,
                message: wErr.errmsg || wErr.message,
              });
            }
          }
          logger.warn(
            `Bulk write partial error in single chunk: ${err.writeErrors?.length || 0} items failed.`
          );
          return {
            insertedCount: insertedFromError,
            insertedIds: err.result?.insertedIds || {},
            documents,
            writeErrors,
          };
        } else if (
          err.statusCode === 503 ||
          err.name === 'MongoServerSelectionError' ||
          err.name === 'MongoNetworkError'
        ) {
          metrics.recordDbError();
          throw new ApiError(503, 'Database service unavailable. Please retry later.');
        } else {
          throw new ApiError(500, `Failed to insert telemetry batch: ${err.message}`);
        }
      }
    }

    const chunks = chunkArray(documents, chunkSize);

    let totalInserted = 0;
    const combinedInsertedIds = {};
    const writeErrors = [];

    for (let i = 0; i < chunks.length; i++) {
      // Yield to event loop between chunks if multi-chunk
      if (i > 0) {
        await yieldToEventLoop();
      }

      const chunk = chunks[i];
      const offset = i * chunkSize;

      try {
        const result = await collection.insertMany(chunk, { ordered: false });
        totalInserted += result.insertedCount || chunk.length;
        if (result.insertedIds) {
          for (const [idx, id] of Object.entries(result.insertedIds)) {
            combinedInsertedIds[offset + Number(idx)] = id;
          }
        }
      } catch (err) {
        // Handle partial write errors from MongoDB { ordered: false }
        if (err.name === 'MongoBulkWriteError' || err.writeErrors) {
          const insertedFromError = err.result?.insertedCount || 0;
          totalInserted += insertedFromError;

          if (err.result?.insertedIds) {
            for (const [idx, id] of Object.entries(err.result.insertedIds)) {
              combinedInsertedIds[offset + Number(idx)] = id;
            }
          }

          if (Array.isArray(err.writeErrors)) {
            for (const wErr of err.writeErrors) {
              writeErrors.push({
                index: offset + wErr.index,
                code: wErr.code,
                message: wErr.errmsg || wErr.message,
              });
            }
          }
          logger.warn(
            `Bulk write partial error in chunk ${i + 1}/${chunks.length}: ${err.writeErrors?.length || 0} items failed.`
          );
        } else if (
          err.statusCode === 503 ||
          err.name === 'MongoServerSelectionError' ||
          err.name === 'MongoNetworkError'
        ) {
          metrics.recordDbError();
          throw new ApiError(503, 'Database service unavailable. Please retry later.');
        } else {
          throw new ApiError(500, `Failed to insert telemetry batch: ${err.message}`);
        }
      }
    }

    return {
      insertedCount: totalInserted,
      insertedIds: combinedInsertedIds,
      documents,
      writeErrors,
    };
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
      if (err.statusCode === 503 || err.name === 'MongoServerSelectionError' || err.name === 'MongoNetworkError') {
        metrics.recordDbError();
        throw new ApiError(503, 'Database service unavailable. Please retry later.');
      }
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
      if (err.statusCode === 503 || err.name === 'MongoServerSelectionError' || err.name === 'MongoNetworkError') {
        metrics.recordDbError();
        throw new ApiError(503, 'Database service unavailable. Please retry later.');
      }
      if (err instanceof ApiError) throw err;
      throw new ApiError(500, `Failed to get latest telemetry: ${err.message}`);
    }
  }
}

export const telemetryRepository = new TelemetryRepository();
export default telemetryRepository;
