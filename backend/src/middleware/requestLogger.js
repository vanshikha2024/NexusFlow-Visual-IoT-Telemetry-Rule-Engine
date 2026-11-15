
import { logger } from '../utils/logger.js';
import { recordRequest, recordFailedRequest  } from '../utils/metrics.js';

export const requestLogger = (req, res, next) => {
  const start = Date.now();
  let failureRecorded = false;

  res.on('finish', () => {
    const duration = Date.now() - start;

    // Track request count and response latency
    recordRequest(duration);

    // Count failed HTTP responses (4xx and 5xx)
    if (res.statusCode >= 400 && !failureRecorded) {
      recordFailedRequest();
      failureRecorded = true;
    }

    const message = `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`;

    if (res.statusCode >= 500) {
      logger.error(message);
    } else if (res.statusCode >= 400) {
      logger.warn(message);
    } else {
      logger.info(message);
    }
  });

  next();
};
