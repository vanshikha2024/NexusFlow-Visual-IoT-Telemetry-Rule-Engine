
import { telemetryRepository } from '../repositories/telemetry.repository.js';
import { logger } from '../utils/logger.js';
import {
  recordSingleIngestion,
  recordBulkIngestion,
  recordFailure,
} from '../utils/metrics.js';

export class TelemetryService {
  constructor(repo = telemetryRepository) {
    this.repo = repo;
  }

  async ingestTelemetry(data) {
    try {
      const result = await this.repo.insertTelemetry(data);
      recordSingleIngestion();

      logger.debug(
        `Ingested telemetry for sensor "${result.metadata?.sensorId}": value=${result.value}`
      );

      return result;
    } catch (error) {
      recordFailure();
      throw error;
    }
  }

  async ingestBulkTelemetry(records) {
    try {
      const result = await this.repo.insertManyTelemetry(records);
      recordBulkIngestion(result.insertedCount);

      logger.info(
        `Bulk ingested ${result.insertedCount} telemetry records`
      );

      return result;
    } catch (error) {
      recordFailure();
      throw error;
    }
  }

  async getTelemetryBySensor(sensorId, options = {}) {
    return await this.repo.findTelemetryBySensor(sensorId, options);
  }

  async getLatestTelemetry(sensorId) {
    return await this.repo.getLatestTelemetry(sensorId);
  }
}

export const telemetryService = new TelemetryService();
export default telemetryService;
