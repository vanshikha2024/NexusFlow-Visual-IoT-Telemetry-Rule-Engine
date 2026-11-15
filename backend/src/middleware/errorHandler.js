import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { metrics } from '../utils/metrics.js';

/**
 * Centralized Express error-handling middleware.
 * Ensures all errors adhere to a standardized JSON schema.
 */
export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal Server Error';
  let errors = err.errors || [];

  // Handle JSON parse errors from express.json()
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    message = 'Malformed JSON payload in request body.';
    errors = [{ field: 'body', message: err.message }];
  }

  // Handle Payload Too Large errors from body-parser
  if (err.type === 'entity.too.large') {
    statusCode = 413;
    message = `Request payload exceeds size limit (${env.MAX_REQUEST_SIZE}).`;
    errors = [{ field: 'body', message: `Payload size exceeded limit of ${env.MAX_REQUEST_SIZE}` }];
  }

  // Handle Database Connection Errors (Mongo / Mongoose)
  if (
    err.name === 'MongoServerSelectionError' ||
    err.name === 'MongoNetworkError' ||
    err.name === 'MongooseServerSelectionError' ||
    statusCode === 503
  ) {
    statusCode = 503;
    message = message.includes('Database') ? message : 'Database service unavailable. Please retry later.';
    metrics.recordDbError();
  }

  if (statusCode >= 500) {
    logger.error(`[Server Error] ${req.method} ${req.originalUrl}:`, err.stack || err);
  } else if (statusCode >= 400) {
    logger.warn(`[Client Error ${statusCode}] ${req.method} ${req.originalUrl}: ${message}`);
  }

  const response = {
    success: false,
    statusCode,
    message,
    ...(errors.length > 0 && { errors }),
    ...(env.isDevelopment && statusCode >= 500 && { stack: err.stack }),
  };

  res.status(statusCode).json(response);
};

export default errorHandler;
