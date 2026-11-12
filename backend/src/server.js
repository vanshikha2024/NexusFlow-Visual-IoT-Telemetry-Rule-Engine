import app from './app.js';
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { logger } from './utils/logger.js';

let server;

const startServer = async () => {
  try {
    // Start Express HTTP listener
    server = app.listen(env.PORT, () => {
      logger.info(
        `NexusFlow backend listening on port ${env.PORT} in ${env.NODE_ENV} mode`
      );
      logger.info(`Health check available at http://localhost:${env.PORT}/api/health`);
    });

    // Initialize MongoDB connection
    connectDB().catch((err) => {
      logger.warn(`Initial MongoDB connection failed: ${err.message}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);

  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed.');
      await disconnectDB();
      process.exit(0);
    });

    // Force shutdown after 10 seconds if hanging
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  } else {
    await disconnectDB();
    process.exit(0);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

startServer();
