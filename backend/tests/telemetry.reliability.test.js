import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { telemetryRepository } from '../src/repositories/telemetry.repository.js';
import { metrics } from '../src/utils/metrics.js';
import { env } from '../src/config/env.js';

describe('Day 4: Bulk Ingestion, Reliability, and Error Handling Tests', () => {
  let server;
  let baseUrl;
  let mockStore = [];
  let shouldFailDatabase = false;

  // Mock in-memory MongoDB collection test double with fault injection support
  const createMockCollection = () => {
    return {
      store: mockStore,
      insertOne: async (doc) => {
        if (shouldFailDatabase) {
          const err = new Error('getaddrinfo ENOTFOUND mongodb.cluster.internal');
          err.name = 'MongoNetworkError';
          throw err;
        }
        const _id = `mock_id_${Date.now()}_${Math.random()}`;
        const inserted = { _id, ...doc };
        mockStore.push(inserted);
        return { acknowledged: true, insertedId: _id };
      },
      insertMany: async (docs) => {
        if (shouldFailDatabase) {
          const err = new Error('connection closed by remote peer');
          err.name = 'MongoServerSelectionError';
          throw err;
        }
        const insertedIds = {};
        docs.forEach((doc, idx) => {
          const _id = `batch_id_${idx}`;
          insertedIds[idx] = _id;
          mockStore.push({ _id, ...doc });
        });
        return {
          acknowledged: true,
          insertedCount: docs.length,
          insertedIds,
        };
      },
      find: () => {
        if (shouldFailDatabase) {
          const err = new Error('Mongo network timeout');
          err.name = 'MongoNetworkError';
          throw err;
        }
        return {
          sort: () => ({
            skip: () => ({
              limit: () => ({
                toArray: async () => [...mockStore],
              }),
            }),
          }),
        };
      },
      findOne: async () => {
        if (shouldFailDatabase) {
          const err = new Error('Mongo network timeout');
          err.name = 'MongoNetworkError';
          throw err;
        }
        return mockStore[0] || null;
      },
    };
  };

  before(async () => {
    mockStore = [];
    shouldFailDatabase = false;
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
    shouldFailDatabase = false;
  });

  // --- 1. Empty Batches ---

  it('rejects empty array batch with 400 Bad Request', async () => {
    const res = await fetch(`${baseUrl}/api/telemetry/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([]),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.statusCode, 400);
    assert.match(body.message, /must be a non-empty array/i);
  });

  it('rejects wrapped { records: [] } with 400 Bad Request', async () => {
    const res = await fetch(`${baseUrl}/api/telemetry/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: [] }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
  });

  // --- 2. Oversized Batches (Batch Size Limit) ---

  it('rejects oversized batch exceeding MAX_BATCH_SIZE with 413 Payload Too Large', async () => {
    const oversizedBatch = [];
    const limit = env.MAX_BATCH_SIZE; // e.g. 500

    for (let i = 0; i <= limit; i++) {
      oversizedBatch.push({
        sensorId: `sensor-${i}`,
        value: 100 + i,
      });
    }

    const res = await fetch(`${baseUrl}/api/telemetry/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(oversizedBatch),
    });

    assert.equal(res.status, 413);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.statusCode, 413);
    assert.match(body.message, /exceeds maximum allowed limit/i);
    assert.equal(mockStore.length, 0); // No documents should have been inserted
  });

  // --- 3. Partial Failures Handling ---

  it('handles partial failures safely by inserting valid records and returning 207 Multi-Status', async () => {
    const mixedBatch = [
      { sensorId: 'turbine-01', value: 1800, unit: 'RPM' }, // Valid
      { sensorId: '', value: 1500 },                         // Invalid: missing sensorId
      { sensorId: 'turbine-02', value: 1850, unit: 'RPM' }, // Valid
      { sensorId: 'temp-01', value: 'not-a-number' },       // Invalid: non-numeric value
      { sensorId: 'temp-02', value: 45.5, unit: '°C' },     // Valid
    ];

    const res = await fetch(`${baseUrl}/api/telemetry/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mixedBatch),
    });

    assert.equal(res.status, 207); // Multi-Status for partial success
    const body = await res.json();

    assert.equal(body.success, true);
    assert.equal(body.data.total, 5);
    assert.equal(body.data.insertedCount, 3);
    assert.equal(body.data.failedCount, 2);
    assert.equal(body.data.isPartial, true);

    // Verify exactly 3 valid documents were written to MongoDB store
    assert.equal(mockStore.length, 3);
    assert.equal(mockStore[0].metadata.sensorId, 'turbine-01');
    assert.equal(mockStore[1].metadata.sensorId, 'turbine-02');
    assert.equal(mockStore[2].metadata.sensorId, 'temp-02');

    // Verify structured error details for the failed records
    assert.equal(body.data.errors.length, 2);
    assert.equal(body.data.errors[0].index, 1);
    assert.equal(body.data.errors[1].index, 3);
  });

  it('rejects batch completely with 400 when all records fail validation', async () => {
    const invalidBatch = [
      { sensorId: '', value: 10 },
      { sensorId: 'valid-id', value: 'invalid-val' },
    ];

    const res = await fetch(`${baseUrl}/api/telemetry/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidBatch),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.message, /all 2 records are invalid/i);
    assert.equal(mockStore.length, 0);
  });

  it('honors allOrNone=true query parameter to reject batch atomically if any item fails', async () => {
    const mixedBatch = [
      { sensorId: 'temp-01', value: 20 },
      { sensorId: '', value: 30 }, // Invalid
    ];

    const res = await fetch(`${baseUrl}/api/telemetry/bulk?allOrNone=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mixedBatch),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.message, /all-or-nothing/i);
    assert.equal(mockStore.length, 0); // Atomic: nothing persisted
  });

  // --- 4. Database Connection & Availability Errors ---

  it('returns 503 Service Unavailable when database connection fails during single insertion', async () => {
    shouldFailDatabase = true;

    const res = await fetch(`${baseUrl}/api/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sensorId: 'sensor-fault-1', value: 50.0 }),
    });

    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.statusCode, 503);
    assert.match(body.message, /Database service unavailable/i);
  });

  it('returns 503 Service Unavailable when database connection fails during bulk insertion', async () => {
    shouldFailDatabase = true;

    const res = await fetch(`${baseUrl}/api/telemetry/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { sensorId: 's1', value: 10 },
        { sensorId: 's2', value: 20 },
      ]),
    });

    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.statusCode, 503);
    assert.match(body.message, /Database service unavailable/i);
  });

  // --- 5. Ingestion Metrics & Observability ---

  it('GET /api/telemetry/metrics tracks accurate operational statistics', async () => {
    // Perform 1 single ingestion
    await fetch(`${baseUrl}/api/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sensorId: 'metric-sensor-alpha', value: 100 }),
    });

    // Perform 1 bulk ingestion with 2 items
    await fetch(`${baseUrl}/api/telemetry/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { sensorId: 'metric-sensor-alpha', value: 101 },
        { sensorId: 'metric-sensor-beta', value: 202 },
      ]),
    });

    const res = await fetch(`${baseUrl}/api/telemetry/metrics`);
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.success, true);
    assert.ok(body.data.ingestion);
    assert.ok(body.data.ingestion.totalIngested >= 3);
    assert.ok(body.data.ingestion.totalBatches >= 1);
    assert.ok(body.data.ingestion.totalSingleRequests >= 1);
    assert.ok(body.data.ingestion.activeSensorsCount >= 2);
    assert.ok(body.data.ingestion.lastIngestedAt);
  });

  // --- 6. Malformed Requests ---

  it('returns 400 Bad Request for malformed JSON syntax in request body', async () => {
    const res = await fetch(`${baseUrl}/api/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ "sensorId": "bad-json", value: invalid }', // Invalid JSON
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.statusCode, 400);
    assert.match(body.message, /Malformed JSON payload/i);
  });
});

