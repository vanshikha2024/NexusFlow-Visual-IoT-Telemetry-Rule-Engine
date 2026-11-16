/**
 * NexusFlow Telemetry API Benchmark & Load-Testing Tool
 *
 * Repeatable, structured performance evaluation measuring:
 * - Single vs. Bulk ingestion throughput (req/s, records/s)
 * - Record accounting: Generated vs Received vs Persisted vs Rejected
 * - Latency percentiles (min, avg, p50, p90, p95, p99, max)
 * - Memory usage (Heap & RSS before, peak, after)
 * - Concurrency scaling across various batch sizes
 */

import http from 'node:http';
import os from 'node:os';
import process from 'node:process';
import app from '../src/app.js';
import { telemetryRepository } from '../src/repositories/telemetry.repository.js';
import { metrics } from '../src/utils/metrics.js';

// Configuration
const CONFIG = {
  PORT: process.env.BENCHMARK_PORT || 5055,
  USE_REAL_DB: process.env.USE_REAL_DB === 'true',
  MOCK_IO_DELAY_MS: parseInt(process.env.MOCK_IO_DELAY_MS || '0', 10),
  SILENT_LOGGER: process.env.SILENT_LOGGER !== 'false',
};

// System Environment Information Collector
export const getEnvironmentInfo = () => {
  const cpus = os.cpus();
  const totalMemGB = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
  const freeMemGB = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);

  return {
    os: `${os.type()} ${os.release()} (${os.arch()})`,
    platform: process.platform,
    cpuModel: cpus[0]?.model || 'Unknown CPU',
    cpuCores: cpus.length,
    cpuSpeedMHz: cpus[0]?.speed || 0,
    totalMemory: `${totalMemGB} GB`,
    freeMemory: `${freeMemGB} GB`,
    nodeVersion: process.version,
    v8Version: process.versions.v8,
  };
};

/**
 * Creates high-performance in-memory mock collection for deterministic pipeline benchmarking
 */
export const createMockCollection = (delayMs = 0) => {
  const store = [];
  let insertedCountTotal = 0;

  return {
    store,
    getInsertedCount: () => insertedCountTotal,
    clear: () => {
      store.length = 0;
      insertedCountTotal = 0;
    },
    insertOne: async (doc) => {
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
      const _id = `mock_${Date.now()}_${Math.random()}`;
      store.push({ _id, ...doc });
      insertedCountTotal++;
      return { acknowledged: true, insertedId: _id };
    },
    insertMany: async (docs) => {
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
      const insertedIds = {};
      for (let i = 0; i < docs.length; i++) {
        const _id = `mock_${i}_${Date.now()}_${Math.random()}`;
        insertedIds[i] = _id;
        store.push({ _id, ...docs[i] });
      }
      insertedCountTotal += docs.length;
      return {
        acknowledged: true,
        insertedCount: docs.length,
        insertedIds,
      };
    },
    find: (filter) => {
      const results = store.filter((item) => {
        if (filter && filter['metadata.sensorId']) {
          return item.metadata?.sensorId === filter['metadata.sensorId'];
        }
        return true;
      });
      const cursor = {
        sort: () => cursor,
        skip: (n) => {
          const s = results.slice(n);
          return {
            limit: (l) => ({ toArray: async () => s.slice(0, l) }),
          };
        },
        limit: (l) => ({ toArray: async () => results.slice(0, l) }),
        toArray: async () => results,
      };
      return cursor;
    },
    findOne: async (filter) => {
      const sensor = filter?.['metadata.sensorId'];
      return store.find((m) => m.metadata?.sensorId === sensor) || null;
    },
  };
};

/**
 * High-performance HTTP client using keep-alive connection pooling
 */
class BenchmarkHttpClient {
  constructor(baseUrl) {
    this.baseUrl = new URL(baseUrl);
    this.agent = new http.Agent({
      keepAlive: true,
      maxSockets: 100,
      keepAliveMsecs: 10000,
    });
  }

  destroy() {
    this.agent.destroy();
  }

  request({ path, method = 'GET', body = null, headers = {} }) {
    return new Promise((resolve, reject) => {
      const payload = body ? JSON.stringify(body) : null;
      const reqHeaders = {
        'Accept': 'application/json',
        ...headers,
      };

      if (payload) {
        reqHeaders['Content-Type'] = 'application/json';
        reqHeaders['Content-Length'] = Buffer.byteLength(payload);
      }

      const options = {
        hostname: this.baseUrl.hostname,
        port: this.baseUrl.port,
        path,
        method,
        headers: reqHeaders,
        agent: this.agent,
      };

      const start = process.hrtime.bigint();
      const req = http.request(options, (res) => {
        let responseBody = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          responseBody += chunk;
        });
        res.on('end', () => {
          const end = process.hrtime.bigint();
          const latencyMs = Number(end - start) / 1e6;
          let parsed = null;
          try {
            parsed = JSON.parse(responseBody);
          } catch {
            parsed = responseBody;
          }
          resolve({
            statusCode: res.statusCode,
            latencyMs,
            body: parsed,
          });
        });
      });

      req.on('error', (err) => {
        const end = process.hrtime.bigint();
        const latencyMs = Number(end - start) / 1e6;
        reject({ error: err, latencyMs });
      });

      if (payload) {
        req.write(payload);
      }
      req.end();
    });
  }
}

/**
 * Computes statistical percentiles from array of numbers
 */
export const calculateStats = (numbers) => {
  if (numbers.length === 0) {
    return { min: 0, max: 0, avg: 0, p50: 0, p90: 0, p95: 0, p99: 0 };
  }
  const sorted = [...numbers].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const avg = sum / sorted.length;

  const percentile = (p) => {
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
  };

  return {
    min: Number(sorted[0].toFixed(2)),
    max: Number(sorted[sorted.length - 1].toFixed(2)),
    avg: Number(avg.toFixed(2)),
    p50: Number(percentile(50).toFixed(2)),
    p90: Number(percentile(90).toFixed(2)),
    p95: Number(percentile(95).toFixed(2)),
    p99: Number(percentile(99).toFixed(2)),
  };
};

/**
 * Concurrency worker queue executor
 */
export const runWorkerQueue = async (tasks, concurrency) => {
  const results = [];
  let index = 0;

  const worker = async () => {
    while (index < tasks.length) {
      const currentIdx = index++;
      try {
        const res = await tasks[currentIdx]();
        results[currentIdx] = { success: true, res };
      } catch (err) {
        results[currentIdx] = { success: false, err };
      }
    }
  };

  const pool = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(pool);
  return results;
};

/**
 * Executes a single test scenario
 */
export const runScenario = async ({
  name,
  description,
  client,
  taskGenerator,
  taskCount,
  concurrency,
  recordCountPerTask,
  expectedInvalidPerTask = 0,
}) => {
  // Snapshot memory before
  if (global.gc) global.gc();
  const memBefore = process.memoryUsage();

  const generatedRecords = taskCount * recordCountPerTask;
  let receivedRecords = 0;
  let persistedRecords = 0;
  let rejectedRecords = 0;
  let successRequests = 0;
  let failedRequests = 0;
  const latencies = [];

  const tasks = Array.from({ length: taskCount }, (_, i) => {
    const payload = taskGenerator(i);
    return async () => {
      const res = await client.request(payload);
      return res;
    };
  });

  const wallStart = process.hrtime.bigint();
  const workerResults = await runWorkerQueue(tasks, concurrency);
  const wallEnd = process.hrtime.bigint();
  const durationMs = Number(wallEnd - wallStart) / 1e6;

  const memAfter = process.memoryUsage();

  for (const item of workerResults) {
    if (!item.success) {
      failedRequests++;
      continue;
    }

    const { statusCode, latencyMs, body } = item.res;
    latencies.push(latencyMs);

    if (statusCode >= 200 && statusCode < 300) {
      successRequests++;
      if (body?.data?.insertedCount !== undefined) {
        receivedRecords += body.data.total || recordCountPerTask;
        persistedRecords += body.data.insertedCount;
        rejectedRecords += body.data.failedCount || 0;
      } else if (body?.data?._id) {
        receivedRecords += 1;
        persistedRecords += 1;
      }
    } else if (statusCode === 207) {
      // Partial Multi-Status
      successRequests++;
      receivedRecords += body.data.total || recordCountPerTask;
      persistedRecords += body.data.insertedCount || 0;
      rejectedRecords += body.data.failedCount || 0;
    } else {
      failedRequests++;
      rejectedRecords += recordCountPerTask;
    }
  }

  const durationSec = durationMs / 1000;
  const reqThroughput = Number((taskCount / (durationSec || 0.001)).toFixed(2));
  const recordThroughput = Number((persistedRecords / (durationSec || 0.001)).toFixed(2));
  const latencyStats = calculateStats(latencies);

  const memHeapDiffMB = Number(
    ((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024).toFixed(2)
  );
  const memRssDiffMB = Number(
    ((memAfter.rss - memBefore.rss) / 1024 / 1024).toFixed(2)
  );

  return {
    name,
    description,
    concurrency,
    taskCount,
    durationMs: Number(durationMs.toFixed(2)),
    records: {
      generated: generatedRecords,
      received: receivedRecords,
      persisted: persistedRecords,
      rejected: rejectedRecords,
    },
    requests: {
      total: taskCount,
      success: successRequests,
      failed: failedRequests,
    },
    throughput: {
      requestsPerSec: reqThroughput,
      recordsPerSec: recordThroughput,
    },
    latency: latencyStats,
    memory: {
      heapBeforeMB: Number((memBefore.heapUsed / 1024 / 1024).toFixed(2)),
      heapAfterMB: Number((memAfter.heapUsed / 1024 / 1024).toFixed(2)),
      heapDiffMB: memHeapDiffMB,
      rssBeforeMB: Number((memBefore.rss / 1024 / 1024).toFixed(2)),
      rssAfterMB: Number((memAfter.rss / 1024 / 1024).toFixed(2)),
      rssDiffMB: memRssDiffMB,
    },
  };
};

/**
 * Main benchmark runner
 */
export const runBenchmarks = async () => {
  // Mute console logging during benchmark if requested to eliminate terminal I/O skew
  const originalEnvLogLevel = process.env.LOG_LEVEL;
  if (CONFIG.SILENT_LOGGER) {
    process.env.LOG_LEVEL = 'silent';
  }

  const envInfo = getEnvironmentInfo();
  console.log('\n===============================================================');
  console.log('      NEXUSFLOW TELEMETRY INGESTION PERFORMANCE BENCHMARK      ');
  console.log('===============================================================');
  console.log(`Node Version : ${envInfo.nodeVersion} (V8: ${envInfo.v8Version})`);
  console.log(`OS Platform  : ${envInfo.os}`);
  console.log(`CPU Model    : ${envInfo.cpuModel} (${envInfo.cpuCores} cores @ ${envInfo.cpuSpeedMHz} MHz)`);
  console.log(`System RAM   : ${envInfo.totalMemory} total, ${envInfo.freeMemory} free`);
  console.log(`Mode         : ${CONFIG.USE_REAL_DB ? 'Real MongoDB' : 'In-Memory Test Double (Mock I/O: ' + CONFIG.MOCK_IO_DELAY_MS + 'ms)'}`);
  console.log('===============================================================\n');

  // Setup mock repository collection if not using real DB
  let mockCollection = null;
  if (!CONFIG.USE_REAL_DB) {
    mockCollection = createMockCollection(CONFIG.MOCK_IO_DELAY_MS);
    telemetryRepository.setCollection(mockCollection);
  }

  // Start HTTP server on dynamic or configured port
  const server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const client = new BenchmarkHttpClient(baseUrl);

  const results = [];

  try {
    // -------------------------------------------------------------
    // SCENARIO 1: Single Ingestion (POST /api/telemetry) - Concurrency 1 (Sequential)
    // -------------------------------------------------------------
    console.log('[1/7] Running Single Ingestion (Sequential, c=1, 200 records)...');
    const singleSequential = await runScenario({
      name: 'Single Ingestion (Sequential)',
      description: '200 single telemetry POST requests processed sequentially (concurrency 1)',
      client,
      taskCount: 200,
      concurrency: 1,
      recordCountPerTask: 1,
      taskGenerator: (i) => ({
        path: '/api/telemetry',
        method: 'POST',
        body: {
          sensorId: `sensor-seq-${i % 10}`,
          value: 20.0 + (i % 50) * 0.1,
          unit: 'celsius',
          timestamp: new Date().toISOString(),
          metadata: { location: 'zone-A', model: 'DHT22' },
        },
      }),
    });
    results.push(singleSequential);

    // -------------------------------------------------------------
    // SCENARIO 2: Single Ingestion (POST /api/telemetry) - Concurrency 20
    // -------------------------------------------------------------
    console.log('[2/7] Running Single Ingestion (Concurrent, c=20, 500 records)...');
    const singleConcurrent = await runScenario({
      name: 'Single Ingestion (Concurrent c=20)',
      description: '500 single telemetry POST requests with concurrency 20',
      client,
      taskCount: 500,
      concurrency: 20,
      recordCountPerTask: 1,
      taskGenerator: (i) => ({
        path: '/api/telemetry',
        method: 'POST',
        body: {
          sensorId: `sensor-conc-${i % 20}`,
          value: 100.0 + (i % 100),
          unit: 'rpm',
          timestamp: new Date().toISOString(),
          metadata: { engineId: `eng-${i % 5}` },
        },
      }),
    });
    results.push(singleConcurrent);

    // -------------------------------------------------------------
    // SCENARIO 3: Bulk Ingestion Small Batches (50 records/batch, c=5)
    // -------------------------------------------------------------
    console.log('[3/7] Running Bulk Ingestion (Batch=50, c=5, 20 batches = 1,000 records)...');
    const bulkSmall = await runScenario({
      name: 'Bulk Ingestion (Batch=50, c=5)',
      description: '20 batch requests of 50 records each (total 1,000 records)',
      client,
      taskCount: 20,
      concurrency: 5,
      recordCountPerTask: 50,
      taskGenerator: (batchIdx) => ({
        path: '/api/telemetry/bulk',
        method: 'POST',
        body: Array.from({ length: 50 }, (_, itemIdx) => ({
          sensorId: `sensor-bulk-small-${(batchIdx * 50 + itemIdx) % 25}`,
          value: 50.0 + itemIdx * 0.5,
          unit: 'psi',
          timestamp: new Date().toISOString(),
        })),
      }),
    });
    results.push(bulkSmall);

    // -------------------------------------------------------------
    // SCENARIO 4: Bulk Ingestion Medium Batches (250 records/batch, c=5)
    // -------------------------------------------------------------
    console.log('[4/7] Running Bulk Ingestion (Batch=250, c=5, 10 batches = 2,500 records)...');
    const bulkMedium = await runScenario({
      name: 'Bulk Ingestion (Batch=250, c=5)',
      description: '10 batch requests of 250 records each (total 2,500 records)',
      client,
      taskCount: 10,
      concurrency: 5,
      recordCountPerTask: 250,
      taskGenerator: (batchIdx) => ({
        path: '/api/telemetry/bulk',
        method: 'POST',
        body: Array.from({ length: 250 }, (_, itemIdx) => ({
          sensorId: `sensor-bulk-med-${(batchIdx * 250 + itemIdx) % 50}`,
          value: 200 + (itemIdx % 50),
          unit: 'kW',
          timestamp: new Date().toISOString(),
          metadata: { grid: 'substation-4' },
        })),
      }),
    });
    results.push(bulkMedium);

    // -------------------------------------------------------------
    // SCENARIO 5: Bulk Ingestion Max Batches (500 records/batch, c=4)
    // -------------------------------------------------------------
    console.log('[5/7] Running Bulk Ingestion Max Batch (Batch=500, c=4, 10 batches = 5,000 records)...');
    const bulkMax = await runScenario({
      name: 'Bulk Ingestion Max Batch (Batch=500, c=4)',
      description: '10 batch requests of maximum batch size (500 records each = 5,000 records total)',
      client,
      taskCount: 10,
      concurrency: 4,
      recordCountPerTask: 500,
      taskGenerator: (batchIdx) => ({
        path: '/api/telemetry/bulk',
        method: 'POST',
        body: Array.from({ length: 500 }, (_, itemIdx) => ({
          sensorId: `sensor-bulk-max-${(batchIdx * 500 + itemIdx) % 100}`,
          value: 1000 + (itemIdx % 100),
          unit: 'lux',
          timestamp: new Date().toISOString(),
          metadata: { plant: 'solar-alpha' },
        })),
      }),
    });
    results.push(bulkMax);

    // -------------------------------------------------------------
    // SCENARIO 6: Partial Failure & Reliability Under Load
    // -------------------------------------------------------------
    console.log('[6/7] Running Bulk Partial-Failure Under Load (10 batches of 100 records with 10% invalid)...');
    const bulkPartial = await runScenario({
      name: 'Bulk Partial Failure Resilience',
      description: '10 batches of 100 records containing 10% intentionally invalid records to verify partial failure isolation',
      client,
      taskCount: 10,
      concurrency: 2,
      recordCountPerTask: 100,
      expectedInvalidPerTask: 10,
      taskGenerator: (batchIdx) => ({
        path: '/api/telemetry/bulk',
        method: 'POST',
        body: Array.from({ length: 100 }, (_, itemIdx) => {
          const isInvalid = itemIdx % 10 === 0;
          return {
            sensorId: isInvalid ? '' : `sensor-partial-${batchIdx}-${itemIdx}`,
            value: isInvalid ? 'NOT_A_NUMBER' : 35.5,
            timestamp: new Date().toISOString(),
          };
        }),
      }),
    });
    results.push(bulkPartial);

    // -------------------------------------------------------------
    // SCENARIO 7: Mixed Traffic (Bulk Ingestion + Single Ingestion + GET Queries)
    // -------------------------------------------------------------
    console.log('[7/7] Running Mixed Traffic Workload (Writes, Bulks, and Reads concurrently)...');
    const mixedWorkload = await runScenario({
      name: 'Mixed Real-World Workload',
      description: '100 interleaved requests: 20 bulk batches (50 items), 50 single writes, and 30 GET queries',
      client,
      taskCount: 100,
      concurrency: 10,
      recordCountPerTask: 10,
      taskGenerator: (i) => {
        if (i % 5 === 0) {
          // Bulk request (50 items)
          return {
            path: '/api/telemetry/bulk',
            method: 'POST',
            body: Array.from({ length: 50 }, (_, k) => ({
              sensorId: `mixed-sensor-${k % 10}`,
              value: 42 + k,
            })),
          };
        } else if (i % 2 === 0) {
          // Single write
          return {
            path: '/api/telemetry',
            method: 'POST',
            body: {
              sensorId: `mixed-sensor-${i % 10}`,
              value: 88.5,
            },
          };
        } else {
          // GET read query
          return {
            path: `/api/telemetry/mixed-sensor-${i % 10}/latest`,
            method: 'GET',
          };
        }
      },
    });
    results.push(mixedWorkload);

  } finally {
    client.destroy();
    server.close();
    if (!CONFIG.USE_REAL_DB) {
      telemetryRepository.resetCollection();
    }
    process.env.LOG_LEVEL = originalEnvLogLevel;
  }

  // Format and print summary table
  printReport(envInfo, results);
  return { envInfo, results };
};

/**
 * Pretty prints tabular results to stdout
 */
const printReport = (envInfo, results) => {
  console.log('\n========================================================================================');
  console.log('                          BENCHMARK MEASUREMENT SUMMARY RESULTS                          ');
  console.log('========================================================================================');

  console.log('\n--- 1. RECORD ACCOUNTING BREAKDOWN ---');
  console.table(
    results.map((r) => ({
      Scenario: r.name,
      'Generated Records': r.records.generated,
      'Received Records': r.records.received,
      'Persisted Records': r.records.persisted,
      'Rejected Records': r.records.rejected,
      'Requests (OK/Fail)': `${r.requests.success}/${r.requests.failed}`,
    }))
  );

  console.log('\n--- 2. THROUGHPUT & SPEED ---');
  console.table(
    results.map((r) => ({
      Scenario: r.name,
      Concurrency: r.concurrency,
      'Duration (ms)': r.durationMs,
      'Requests / sec': r.throughput.requestsPerSec,
      'Writes / sec (Records)': r.throughput.recordsPerSec,
    }))
  );

  console.log('\n--- 3. LATENCY DISTRIBUTION (ms) ---');
  console.table(
    results.map((r) => ({
      Scenario: r.name,
      'Min (ms)': r.latency.min,
      'Avg (ms)': r.latency.avg,
      'p50 (ms)': r.latency.p50,
      'p90 (ms)': r.latency.p90,
      'p95 (ms)': r.latency.p95,
      'p99 (ms)': r.latency.p99,
      'Max (ms)': r.latency.max,
    }))
  );

  console.log('\n--- 4. MEMORY IMPACT (MB) ---');
  console.table(
    results.map((r) => ({
      Scenario: r.name,
      'Heap Before': `${r.memory.heapBeforeMB} MB`,
      'Heap After': `${r.memory.heapAfterMB} MB`,
      'Heap Delta': `${r.memory.heapDiffMB >= 0 ? '+' : ''}${r.memory.heapDiffMB} MB`,
      'RSS Before': `${r.memory.rssBeforeMB} MB`,
      'RSS After': `${r.memory.rssAfterMB} MB`,
      'RSS Delta': `${r.memory.rssDiffMB >= 0 ? '+' : ''}${r.memory.rssDiffMB} MB`,
    }))
  );

  console.log('========================================================================================\n');
};

// Auto-run if executed directly
if (process.argv[1]?.endsWith('benchmark.js')) {
  runBenchmarks()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('Benchmark execution failed:', err);
      process.exit(1);
    });
}
