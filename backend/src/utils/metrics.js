import { getDatabaseStatus } from '../config/db.js';

class TelemetryMetrics {
  constructor() {
    this.reset();
  }

  reset() {
    this.startTime = Date.now();
    this.totalIngested = 0;
    this.totalFailed = 0;
    this.totalBatches = 0;
    this.totalSingleRequests = 0;
    this.totalIngestionTimeMs = 0;
    this.dbErrorsCount = 0;
    this.lastIngestedAt = null;
    this.activeSensors = new Map(); // sensorId -> { count, lastSeen }
  }

  /**
   * Records a successful or partial telemetry ingestion event.
   * @param {Object} params
   * @param {number} params.count - Number of successfully ingested records
   * @param {number} params.failed - Number of failed/rejected records
   * @param {number} params.durationMs - Processing time in milliseconds
   * @param {Array<string>} [params.sensorIds=[]] - Array of sensor IDs involved
   * @param {boolean} [params.isBatch=false] - Whether this was a bulk operation
   */
  recordIngestion({ count, failed = 0, durationMs = 0, sensorIds = [], isBatch = false }) {
    this.totalIngested += count;
    this.totalFailed += failed;
    this.totalIngestionTimeMs += durationMs;

    if (isBatch) {
      this.totalBatches += 1;
    } else {
      this.totalSingleRequests += 1;
    }

    if (count > 0) {
      this.lastIngestedAt = new Date().toISOString();
    }

    const now = new Date().toISOString();
    for (const sensorId of sensorIds) {
      if (sensorId && typeof sensorId === 'string') {
        const existing = this.activeSensors.get(sensorId) || { count: 0, lastSeen: now };
        this.activeSensors.set(sensorId, {
          count: existing.count + 1,
          lastSeen: now,
        });
      }
    }
  }

  /**
   * Records a database connection or query failure event.
   */
  recordDbError() {
    this.dbErrorsCount += 1;
  }

  /**
   * Returns a snapshot of current telemetry ingestion metrics.
   * @returns {Object}
   */
  getMetrics() {
    const totalRequests = this.totalBatches + this.totalSingleRequests;
    const avgLatencyMs =
      totalRequests > 0
        ? Number((this.totalIngestionTimeMs / totalRequests).toFixed(2))
        : 0;

    return {
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      ingestion: {
        totalIngested: this.totalIngested,
        totalFailed: this.totalFailed,
        totalBatches: this.totalBatches,
        totalSingleRequests: this.totalSingleRequests,
        totalRequests,
        averageLatencyMs: avgLatencyMs,
        lastIngestedAt: this.lastIngestedAt,
        activeSensorsCount: this.activeSensors.size,
      },
      database: {
        status: getDatabaseStatus(),
        connectionErrors: this.dbErrorsCount,
      },
    };
  }

  /**
   * Returns list of active sensors.
   * @returns {Array<{ sensorId: string, count: number, lastSeen: string }>}
   */
  getActiveSensors() {
    const list = [];
    for (const [sensorId, meta] of this.activeSensors.entries()) {
      list.push({ sensorId, ...meta });
    }
    return list;
  }
}

export const metrics = new TelemetryMetrics();
export default metrics;

