
const metrics = {
  totalIngested: 0,
  totalFailed: 0,
  totalFailedRequests: 0,
  totalBatches: 0,
  totalSingleRequests: 0,
  totalRequests: 0,
  totalLatency: 0,
  lastIngestionTime: null,
  databaseErrors: 0,
};

export const recordRequest = (latency = 0) => {
  metrics.totalRequests += 1;
  metrics.totalLatency += latency;
};

export const recordSingleIngestion = () => {
  metrics.totalSingleRequests += 1;
  metrics.totalIngested += 1;
  metrics.lastIngestionTime = new Date();
};

export const recordBulkIngestion = (count) => {
  metrics.totalBatches += 1;
  metrics.totalIngested += count;
  metrics.lastIngestionTime = new Date();
};

export const recordFailure = () => {
  metrics.totalFailed += 1;
};

export const recordFailedRequest = () => {
  metrics.totalFailedRequests += 1;
};

export const recordDatabaseError = () => {
  metrics.databaseErrors += 1;
};

export const getRuntimeMetrics = () => ({
  ...metrics,
  averageLatency:
    metrics.totalRequests > 0
      ? Number((metrics.totalLatency / metrics.totalRequests).toFixed(2))
      : 0,
});

export default {
  recordRequest,
  recordSingleIngestion,
  recordBulkIngestion,
  recordFailure,
  recordFailedRequest,
  recordDatabaseError,
  getRuntimeMetrics,
};
