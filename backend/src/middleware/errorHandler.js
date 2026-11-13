import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Centralized Express error-handling middleware.
 */
export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const errors = err.errors || [];

  if (statusCode >= 500) {
    logger.error(`[Unhandled Error] ${req.method} ${req.originalUrl}:`, err.stack || err);
  }

  const response = {
    success: false,
    statusCode,
    message,
    ...(errors.length > 0 && { errors }),
    ...(env.isDevelopment && { stack: err.stack }),
  };

  res.status(statusCode).json(response);
};

