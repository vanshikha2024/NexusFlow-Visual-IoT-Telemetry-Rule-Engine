import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { telemetryRepository } from '../src/repositories/telemetry.repository.js';
import { metrics } from '../src/utils/metrics.js';

describe('Day 5: Concurrent Requests and High-Concurrency Ingestion Tests', () => {
  let server;
  let baseUrl;
  let mockStore = [];

  const createMockCollection = () => {
    return {
      store: mockStore,
      insertOne: async (doc) => {
        // Add tiny async delay to simulate real I/O and expose any concurrency race conditions
        await new Promise((resolve) => setTimeout(resolve, 1));
        const _id = `mock_id_${Date.now()}_${Math.random()}`;
        const inserted = { _id, ...doc };
        mockStore.push(inserted);
        return { acknowledged: true, insertedId: _id };
      },
      insertMany: async (docs) => {
        await new Promise((resolve) => setTimeout(resolve, 2));
        const insertedIds = {};
        docs.forEach((doc, idx) => {
          const _id = `mock_id_${idx}_${Date.now()}_${Math.random()}`;
          insertedIds[idx] = _id;
          mockStore.push({ _id, ...doc });
        });
        return {
          acknowledged: true,
          insertedCount: docs.length,
          insertedIds,
        };
      },
      find: (filter) => {
        const results = mockStore.filter((item) => {
          if (filter['metadata.sensorId']) {
            return item.metadata?.sensorId === filter['metadata.sensorId'];
          }
          return true;
        });
        const cursor = {
          sort: () => cursor,
          skip: (n) => {
            const sliced = results.slice(n);
            return {
              limit: (limitN) => ({
                toArray: async () => sliced.slice(0, limitN),
              }),
            };
          },
          limit: (n) => ({
            toArray: async () => results.slice(0, n),
          }),
          toArray: async () => results,
        };
        return cursor;
      },
      findOne: async (filter) => {
        const sensor = filter['metadata.sensorId'];
        return mockStore.find((m) => m.metadata?.sensorId === sensor) || null;
      },
    };
  };

  before(async () => {
    mockStore = [];
    metrics.reset();
    telemetryRepository.setCollection(createMockCollection());

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    telemetryRepository.resetCollection();
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    mockStore.length = 0;
  });

  it('handles 50 simultaneous single ingestion requests without race conditions', async () => {
    const concurrentCount = 50;
    const promises = [];

    for (let i = 0; i < concurrentCount; i++) {
      const payload = {
        sensorId: `sensor-${i % 5}`, // 5 distinct sensors
        value: 100 + i,
        unit: 'RPM',
      };

      promises.push(
        fetch(`${baseUrl}/api/telemetry`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).then(async (res) => {
          assert.equal(res.status, 201);
          const body = await res.json();
          assert.equal(body.success, true);
          return body.data;
        })
      );
    }

    const results = await Promise.all(promises);
    assert.equal(results.length, concurrentCount);
    assert.equal(mockStore.length, concurrentCount);
  });

  it('handles 10 simultaneous bulk batches of 20 records each (200 total records)', async () => {
    const batchCount = 10;
    const recordsPerBatch = 20;
    const promises = [];

    for (let b = 0; b < batchCount; b++) {
      const records = [];
      for (let r = 0; r < recordsPerBatch; r++) {
        records.push({
          sensorId: `bulk-sensor-${b}`,
          value: b * 100 + r,
          unit: '°C',
        });
      }

      promises.push(
        fetch(`${baseUrl}/api/telemetry/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(records),
        }).then(async (res) => {
          assert.equal(res.status, 201);
          const body = await res.json();
          assert.equal(body.success, true);
          assert.equal(body.data.insertedCount, recordsPerBatch);
          return body.data;
        })
      );
    }

    const results = await Promise.all(promises);
    assert.equal(results.length, batchCount);
    assert.equal(mockStore.length, batchCount * recordsPerBatch);
  });

  it('maintains data consistency during mixed concurrent read and write operations', async () => {
    // 1. Seed some initial records
    await fetch(`${baseUrl}/api/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sensorId: 'mixed-sensor-1', value: 10.0 }),
    });

    // 2. Fire 30 concurrent operations (10 single writes, 10 bulk writes, 10 reads)
    const operations = [];

    // 10 single writes
    for (let i = 0; i < 10; i++) {
      operations.push(
        fetch(`${baseUrl}/api/telemetry`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sensorId: 'mixed-sensor-1', value: 20.0 + i }),
        }).then((res) => {
          assert.equal(res.status, 201);
        })
      );
    }

    // 10 bulk writes (each 5 items = 50 items)
    for (let i = 0; i < 10; i++) {
      const batch = Array.from({ length: 5 }, (_, k) => ({
        sensorId: 'mixed-sensor-2',
        value: 50.0 + k,
      }));
      operations.push(
        fetch(`${baseUrl}/api/telemetry/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(batch),
        }).then((res) => {
          assert.equal(res.status, 201);
        })
      );
    }

    // 10 concurrent reads
    for (let i = 0; i < 10; i++) {
      operations.push(
        fetch(`${baseUrl}/api/telemetry/mixed-sensor-1`).then((res) => {
          assert.equal(res.status, 200);
        })
      );
    }

    await Promise.all(operations);

    // Initial 1 + 10 single + (10 * 5) bulk = 61 records
    assert.equal(mockStore.length, 61);

    // Verify metrics accurately recorded the operations
    const metricsRes = await fetch(`${baseUrl}/api/telemetry/metrics`);
    const metricsBody = await metricsRes.json();
    assert.equal(metricsRes.status, 200);
    assert.ok(metricsBody.data.ingestion.totalIngested >= 61);
  });
});
