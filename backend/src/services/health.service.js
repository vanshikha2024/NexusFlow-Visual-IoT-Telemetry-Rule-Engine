import { env } from '../config/env.js';
import { getDatabaseStatus } from '../config/db.js';

export class HealthService {
  /**
   * Generates health status diagnostic data.
   */
  static getHealthStatus() {
    return {
      status: 'UP',
      service: 'NexusFlow Backend API',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      environment: env.NODE_ENV,
      database: {
        type: 'MongoDB',
        status: getDatabaseStatus(),
      },
    };
  }
}
