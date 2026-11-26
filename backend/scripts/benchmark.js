import http from 'node:http';
import os from 'node:os';
import process from 'node:process';
import app from '../src/app.js';
import { telemetryRepository } from '../src/repositories/telemetry.repository.js';
import {
  connectDB,
  disconnectDB,
  getDatabaseName,
  isConnected,
} from '../src/config/db.js';

const BENCHMARK_DB = (process.env.BENCHMARK_DB || 'mock').toLowerCase();

const createMockCollection = () => {
  let insertedCount = 0;
  let nextId = 1;

  return {
    getInsertedCount: () => insertedCount,

    clear() {
      insertedCount = 0;
      nextId = 1;
    },

    async insertOne(document) {
      insertedCount++;
      return {
        acknowledged: true,
        insertedId: `benchmark_${nextId++}`,
      };
    },

    async insertMany(documents) {
      const insertedIds = {};

      for (let i = 0; i < documents.length; i++) {
        insertedIds[i] = `benchmark_${nextId++}`;
      }

      insertedCount += documents.length;

      return {
        acknowledged: true,
        insertedCount: documents.length,
        insertedIds,
      };
    },
  };
};

const percentile = (values, p) => {
  if (!values.length) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;

  return Number(sorted[Math.max(0, index)].toFixed(2));
};

const calculateStats = (values) => ({
  min: Number(Math.min(...values).toFixed(2)),
  avg: Number(
    (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)
  ),
  p50: percentile(values, 50),
  p90: percentile(values, 90),
  p95: percentile(values, 95),
  p99: percentile(values, 99),
  max: Number(Math.max(...values).toFixed(2)),
});

class BenchmarkClient {
  constructor(port) {
    this.agent = new http.Agent({
      keepAlive: true,
      maxSockets: 100,
    });
    this.port = port;
  }

  destroy() {
    this.agent.destroy();
  }

  request(path, body) {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(body);
      const started = process.hrtime.bigint();

      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: this.port,
          path,
          method: 'POST',
          agent: this.agent,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
        },
        (res) => {
          let responseBody = '';

          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            responseBody += chunk;
          });

          res.on('end', () => {
            const latencyMs =
              Number(process.hrtime.bigint() - started) / 1e6;

            let parsed;
            try {
              parsed = JSON.parse(responseBody);
            } catch {
              parsed = null;
            }

            resolve({
              statusCode: res.statusCode,
              latencyMs,
              body: parsed,
            });
          });
        }
      );

      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }
}

const runWorkers = async (tasks, concurrency) => {
  const results = new Array(tasks.length);
  let next = 0;

  const worker = async () => {
    while (true) {
      const index = next++;
      if (index >= tasks.length) return;

      try {
        results[index] = await tasks[index]();
      } catch (error) {
        results[index] = {
          statusCode: 0,
          latencyMs: 0,
          error: error.message,
        };
      }
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, tasks.length) },
      () => worker()
    )
  );

  return results;
};

const scenarioSlug = (scenario) =>
  scenario.toLowerCase().replace(/[^a-z0-9]+/g, '-');

const makeRecord = (scenario, index, runId) => ({
  sensorId: `${runId}-${scenarioSlug(scenario)}-sensor-${index % 100}`,
  value: Number((20 + (index % 100) * 0.5).toFixed(2)),
  unit: 'celsius',
  timestamp: new Date().toISOString(),
  metadata: {
    source: 'nexusflow-benchmark',
    scenario,
  },
});

const runScenario = async ({
  name,
  taskCount,
  concurrency,
  batchSize,
  client,
  runId,
}) => {
  if (global.gc) global.gc();

  const memoryBefore = process.memoryUsage();
  const generated = taskCount * batchSize;

  const tasks = Array.from({ length: taskCount }, (_, taskIndex) => {
    const records = Array.from(
      { length: batchSize },
      (_, recordIndex) =>
        makeRecord(name, taskIndex * batchSize + recordIndex, runId)
    );

    return () =>
      client.request(
        batchSize === 1 ? '/api/telemetry' : '/api/telemetry/bulk',
        batchSize === 1 ? records[0] : records
      );
  });

  const started = process.hrtime.bigint();
  const results = await runWorkers(tasks, concurrency);
  const durationMs =
    Number(process.hrtime.bigint() - started) / 1e6;

  const memoryAfter = process.memoryUsage();

  const successful = results.filter(
    (result) => result.statusCode >= 200 && result.statusCode < 300
  );

  const failed = results.filter(
    (result) => !(result.statusCode >= 200 && result.statusCode < 300)
  );

  const persisted = successful.reduce((total, result) => {
    if (batchSize === 1) {
      return total + (result.body?.data?._id ? 1 : 0);
    }

    return total + (result.body?.data?.insertedCount || 0);
  }, 0);

  const latencies = results
    .filter((result) => result.statusCode > 0)
    .map((result) => result.latencyMs);

  const seconds = durationMs / 1000;

  return {
    name,
    concurrency,
    batchSize,
    generated,
    persisted,
    failedRequests: failed.length,
    durationMs: Number(durationMs.toFixed(2)),
    requestsPerSec: Number((taskCount / seconds).toFixed(2)),
    recordsPerSec: Number((persisted / seconds).toFixed(2)),
    latency: calculateStats(latencies),
    memory: {
      heapBeforeMB: Number(
        (memoryBefore.heapUsed / 1048576).toFixed(2)
      ),
      heapAfterMB: Number(
        (memoryAfter.heapUsed / 1048576).toFixed(2)
      ),
      rssBeforeMB: Number(
        (memoryBefore.rss / 1048576).toFixed(2)
      ),
      rssAfterMB: Number(
        (memoryAfter.rss / 1048576).toFixed(2)
      ),
    },
  };
};

const runBenchmarks = async () => {
  if (!['mock', 'mongodb'].includes(BENCHMARK_DB)) {
    throw new Error('Invalid BENCHMARK_DB. Use "mock" or "mongodb".');
  }

  const runId = `bench-${Date.now()}-${process.pid}`;
  const mockCollection =
    BENCHMARK_DB === 'mock' ? createMockCollection() : null;

  let server;
  let client;
  let databaseConnectedByBenchmark = false;
  const results = [];

  try {
    if (BENCHMARK_DB === 'mongodb') {
      const wasConnected = isConnected();
      const connection = await connectDB();

      if (!connection || !isConnected()) {
        throw new Error(
          'MongoDB connection failed. Benchmark aborted; no mock fallback will be used.'
        );
      }

      databaseConnectedByBenchmark = !wasConnected;
    } else {
      telemetryRepository.setCollection(mockCollection);
    }

    server = http.createServer(app);

    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });

    const port = server.address().port;
    client = new BenchmarkClient(port);
    const cpu = os.cpus();

    console.log('\n=== NEXUSFLOW TELEMETRY BENCHMARK ===');
    console.log(`Mode: ${BENCHMARK_DB.toUpperCase()}`);
    console.log(`Run ID: ${runId}`);
    console.log(`Node: ${process.version}`);
    console.log(`Platform: ${os.platform()} ${os.arch()}`);
    console.log(`CPU: ${cpu[0]?.model || 'Unknown'} (${cpu.length} cores)`);

    console.log(
      BENCHMARK_DB === 'mongodb'
        ? `Database: MongoDB (${getDatabaseName()})`
        : 'Database: IN-MEMORY MOCK (MongoDB is not used)'
    );

    console.log(`Port: ${port}\n`);

    const scenarios = [
      {
        name: 'Single Sequential',
        taskCount: 200,
        concurrency: 1,
        batchSize: 1,
      },
      {
        name: 'Single Concurrent',
        taskCount: 1000,
        concurrency: 20,
        batchSize: 1,
      },
      {
        name: 'Bulk 100',
        taskCount: 20,
        concurrency: 5,
        batchSize: 100,
      },
      {
        name: 'Bulk 500',
        taskCount: 10,
        concurrency: 5,
        batchSize: 500,
      },
      {
        name: 'Bulk 1000',
        taskCount: 10,
        concurrency: 5,
        batchSize: 1000,
      },
    ];

    for (let i = 0; i < scenarios.length; i++) {
      const scenario = scenarios[i];

      console.log(
        `[${i + 1}/${scenarios.length}] Running ${scenario.name}...`
      );

      if (mockCollection) mockCollection.clear();

      const result = await runScenario({
        ...scenario,
        client,
        runId,
      });

      result.apiReportedPersisted = result.persisted;

      if (BENCHMARK_DB === 'mongodb') {
        const prefix = `${runId}-${scenarioSlug(scenario.name)}-sensor-`;

        const verifiedCount = await telemetryRepository
          .getCollection()
          .countDocuments({
            'metadata.sensorId': { $regex: `^${prefix}` },
          });

        result.persisted = verifiedCount;
        result.databaseVerified = true;
      } else {
        result.persisted = mockCollection.getInsertedCount();
        result.mockInsertedCount = result.persisted;
      }

      result.recordsPerSec = Number(
        (result.persisted / (result.durationMs / 1000)).toFixed(2)
      );

      results.push(result);
    }
  } finally {
    if (client) client.destroy();

    if (server?.listening) {
      await new Promise((resolve) => server.close(resolve));
    }

    if (BENCHMARK_DB === 'mock') {
      telemetryRepository.resetCollection();
    }

    if (databaseConnectedByBenchmark) {
      await disconnectDB();
    }
  }

  console.log('\n=== THROUGHPUT AND RECORD ACCOUNTING ===');

  console.table(
    results.map((r) => ({
      Scenario: r.name,
      Generated: r.generated,
      APIReported: r.apiReportedPersisted,
      Persisted: r.persisted,
      Verified: BENCHMARK_DB === 'mongodb' ? r.databaseVerified : 'Mock',
      MockInserted: r.mockInsertedCount ?? '-',
      FailedRequests: r.failedRequests,
      'Records/sec': r.recordsPerSec,
      'Requests/sec': r.requestsPerSec,
    }))
  );

  console.log('\n=== LATENCY (milliseconds) ===');

  console.table(
    results.map((r) => ({
      Scenario: r.name,
      ...r.latency,
    }))
  );

  console.log('\n=== MEMORY (MB) ===');

  console.table(
    results.map((r) => ({
      Scenario: r.name,
      HeapBefore: r.memory.heapBeforeMB,
      HeapAfter: r.memory.heapAfterMB,
      RSSBefore: r.memory.rssBeforeMB,
      RSSAfter: r.memory.rssAfterMB,
    }))
  );

  const totalGenerated = results.reduce(
    (sum, result) => sum + result.generated,
    0
  );

  const totalPersisted = results.reduce(
    (sum, result) => sum + result.persisted,
    0
  );

  console.log('\n=== FINAL ACCOUNTING ===');
  console.log(`Mode: ${BENCHMARK_DB.toUpperCase()}`);
  console.log(`Generated records: ${totalGenerated}`);
  console.log(`Persisted records: ${totalPersisted}`);
  console.log(`Missing records: ${totalGenerated - totalPersisted}`);

  return results;
};
runBenchmarks().catch((error) => {
  console.error('Benchmark failed:', error);
  process.exitCode = 1;
});

