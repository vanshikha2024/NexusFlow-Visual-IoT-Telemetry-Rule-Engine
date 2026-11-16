import { telemetryRepository } from '../repositories/telemetry.repository.js';
import { metrics } from '../utils/metrics.js';
import { logger } from '../utils/logger.js';

export class TelemetryService {
  /**
   * @param {import('../repositories/telemetry.repository.js').TelemetryRepository} [repo]
   */
  constructor(repo = telemetryRepository) {
    this.repo = repo;
  }

  /**
   * Ingests a single telemetry record with metric tracking.
   * @param {Object} data - Validated telemetry record
   * @returns {Promise<Object>} Persisted document
   */
  async ingestTelemetry(data) {
    const start = Date.now();
    const result = await this.repo.insertTelemetry(data);
    const durationMs = Date.now() - start;

    const sensorId = result.metadata?.sensorId || data.sensorId;
    metrics.recordIngestion({
      count: 1,
      failed: 0,
      durationMs,
      sensorIds: sensorId ? [sensorId] : [],
      isBatch: false,
    });

    logger.debug(`Ingested telemetry in ${durationMs}ms for sensor "${sensorId}": value=${result.value}`);
    return result;
  }

  /**
   * Ingests bulk telemetry with partial failure isolation and metric tracking.
   *
   * @param {Object} payload
   * @param {Array<{ originalIndex: number, record: Object }>} payload.validRecords
   * @param {Array<{ index: number, sensorId: string, errors: Array }>} payload.rejectedRecords
   * @param {number} payload.total
   * @returns {Promise<Object>} Ingestion summary with counts, IDs, and error details
   */
  async ingestBulkTelemetry({ validRecords = [], rejectedRecords = [], total = 0 }) {
    const start = Date.now();
    let insertedCount = 0;
    let insertedIds = {};
    const writeErrors = [];

    // Insert all valid records into the database
    if (validRecords.length > 0) {
      const recordsToInsert = validRecords.map((item) => item.record);
      const dbResult = await this.repo.insertManyTelemetry(recordsToInsert);

      insertedCount = dbResult.insertedCount;
      insertedIds = dbResult.insertedIds;

      // Handle any DB write errors returned by unordered insert
      if (Array.isArray(dbResult.writeErrors) && dbResult.writeErrors.length > 0) {
        for (const wErr of dbResult.writeErrors) {
          const original = validRecords[wErr.index];
          writeErrors.push({
            index: original ? original.originalIndex : wErr.index,
            sensorId: original?.record?.sensorId || null,
            errors: [{ field: 'database', message: wErr.message }],
          });
        }
      }
    }

    const durationMs = Date.now() - start;
    const combinedErrors = [...rejectedRecords, ...writeErrors];
    const failedCount = combinedErrors.length;

    // Collect unique sensor IDs for metrics without redundant array allocations
    const activeSensorsSet = new Set();
    for (let i = 0; i < validRecords.length; i++) {
      const rec = validRecords[i].record;
      const sId = rec?.metadata?.sensorId || rec?.sensorId;
      if (sId) activeSensorsSet.add(sId);
    }
    const activeSensors = Array.from(activeSensorsSet);

    metrics.recordIngestion({
      count: insertedCount,
      failed: failedCount,
      durationMs,
      sensorIds: activeSensors,
      isBatch: true,
    });

    logger.info(
      `Bulk ingestion completed in ${durationMs}ms: ${insertedCount}/${total} inserted, ${failedCount} rejected.`
    );

    return {
      total,
      insertedCount,
      failedCount,
      isPartial: failedCount > 0 && insertedCount > 0,
      insertedIds,
      ...(failedCount > 0 ? { errors: combinedErrors } : {}),
    };
  }

  /**
   * Queries telemetry history for a sensor.
   * @param {string} sensorId
   * @param {Object} [options]
   */
  async getTelemetryBySensor(sensorId, options = {}) {
    return await this.repo.findTelemetryBySensor(sensorId, options);
  }

  /**
   * Retrieves the most recent telemetry document for a sensor.
   * @param {string} sensorId
   */
  async getLatestTelemetry(sensorId) {
    return await this.repo.getLatestTelemetry(sensorId);
  }

  /**
   * Returns a snapshot of system telemetry metrics.
   */
  getMetrics() {
    return metrics.getMetrics();
  }
}

export const telemetryService = new TelemetryService();
export default telemetryService;
