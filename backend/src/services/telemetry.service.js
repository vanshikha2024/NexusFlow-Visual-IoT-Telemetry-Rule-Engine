import { telemetryRepository } from '../repositories/telemetry.repository.js';
import { logger } from '../utils/logger.js';

export class TelemetryService {
  /**
   * @param {import('../repositories/telemetry.repository.js').TelemetryRepository} [repo]
   */
  constructor(repo = telemetryRepository) {
    this.repo = repo;
  }

  /**
   * Ingests a single telemetry record.
   * @param {Object} data - Validated telemetry record
   * @returns {Promise<Object>} Persisted document
   */
  async ingestTelemetry(data) {
    const result = await this.repo.insertTelemetry(data);
    logger.debug(`Ingested telemetry for sensor "${result.metadata?.sensorId}": value=${result.value}`);
    return result;
  }

  /**
   * Ingests multiple telemetry records in bulk.
   * @param {Array<Object>} records - Validated telemetry records array
   * @returns {Promise<{ insertedCount: number, insertedIds: Record<number, any>, documents: Array<Object> }>}
   */
  async ingestBulkTelemetry(records) {
    const result = await this.repo.insertManyTelemetry(records);
    logger.info(`Bulk ingested ${result.insertedCount} telemetry records`);
    return result;
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
}

export const telemetryService = new TelemetryService();
export default telemetryService;
