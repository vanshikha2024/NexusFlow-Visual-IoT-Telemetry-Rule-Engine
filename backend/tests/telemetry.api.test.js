import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { telemetryRepository } from '../src/repositories/telemetry.repository.js';

describe('Telemetry Ingestion REST API (Express Integration Tests)', () => {
  let server;
  let baseUrl;
  let mockStore = [];

  // Mock in-memory MongoDB collection test double
  const createMockCollection = () => {
    return {
      store: mockStore,
      insertOne: async (doc) => {
        const _id = `mock_id_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const inserted = { _id, ...doc };
        mockStore.push(inserted);
        return { acknowledged: true, insertedId: _id };
      },
      insertMany: async (docs) => {
        const insertedIds = {};
        docs.forEach((doc, idx) => {
          const _id = `mock_batch_${idx}_${Date.now()}`;
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
        let results = mockStore.filter((item) => {
          for (const [key, expected] of Object.entries(filter)) {
            if (key === 'metadata.sensorId') {
              if (item.metadata?.sensorId !== expected) return false;
            } else if (key === 'timestamp' && typeof expected === 'object') {
              if (expected.$gte && item.timestamp < expected.$gte) return false;
              if (expected.$lte && item.timestamp > expected.$lte) return false;
            }
          }
          return true;
        });

        const cursor = {
          sort: () => cursor,
          skip: (n) => {
            results = results.slice(n);
            return cursor;
          },
          limit: (n) => {
            results = results.slice(0, n);
            return cursor;
          },
          toArray: async () => [...results],
        };
        return cursor;
      },
      findOne: async (filter) => {
        const sensor = filter['metadata.sensorId'];
        const matched = mockStore
          .filter((item) => item.metadata?.sensorId === sensor)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return matched[0] || null;
      },
    };
  };

  before(async () => {
    mockStore = [];
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

  // --- POST /api/telemetry (Single Ingestion) ---

  it('POST /api/telemetry returns 201 and persists valid telemetry', async () => {
    const payload = {
      sensorId: 'turbine-sensor-01',
      sensorType: 'Turbine Sensor',
      value: 1850.5,
      unit: 'RPM',
      location: 'Sector 4',
    };

    const res = await fetch(`${baseUrl}/api/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.statusCode, 201);
    assert.equal(body.message, 'Telemetry record ingested successfully');
    assert.ok(body.data._id);
    assert.equal(body.data.metadata.sensorId, 'turbine-sensor-01');
    assert.equal(body.data.metadata.sensorType, 'Turbine Sensor');
    assert.equal(body.data.value, 1850.5);
    assert.equal(body.data.unit, 'RPM');
    assert.ok(body.data.timestamp);
  });

  it('POST /api/telemetry accepts custom ISO timestamp', async () => {
    const customTime = '2026-11-14T08:30:00.000Z';
    const payload = {
      sensorId: 'temp-sensor-02',
      value: 72.4,
      unit: '°C',
      timestamp: customTime,
    };

    const res = await fetch(`${baseUrl}/api/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.data.timestamp, customTime);
    assert.equal(body.data.metadata.sensorId, 'temp-sensor-02');
  });

  it('POST /api/telemetry returns 400 when sensorId is missing', async () => {
    const payload = {
      value: 100,
      unit: 'RPM',
    };

    const res = await fetch(`${baseUrl}/api/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.statusCode, 400);
    assert.ok(body.errors.some((e) => e.field.includes('sensorId')));
  });

  it('POST /api/telemetry returns 400 when value is missing or non-numeric', async () => {
    // Missing value
    const res1 = await fetch(`${baseUrl}/api/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sensorId: 'sensor-1' }),
    });
    assert.equal(res1.status, 400);

    // Non-numeric value
    const res2 = await fetch(`${baseUrl}/api/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sensorId: 'sensor-1', value: 'invalid_number' }),
    });
    assert.equal(res2.status, 400);
    const body2 = await res2.json();
    assert.ok(body2.errors.some((e) => e.field.includes('value')));
  });

  it('POST /api/telemetry returns 400 when timestamp is malformed', async () => {
    const payload = {
      sensorId: 'sensor-1',
      value: 50,
      timestamp: 'not-a-valid-date-string',
    };

    const res = await fetch(`${baseUrl}/api/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.errors.some((e) => e.field.includes('timestamp')));
  });

  it('POST /api/telemetry returns 400 for empty JSON body', async () => {
    const res = await fetch(`${baseUrl}/api/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
  });

  // --- POST /api/telemetry/bulk (Bulk Ingestion) ---

  it('POST /api/telemetry/bulk returns 201 for raw array of valid telemetry', async () => {
    const batch = [
      { sensorId: 'temp-01', value: 22.5, unit: '°C' },
      { sensorId: 'temp-02', value: 24.1, unit: '°C' },
      { sensorId: 'turbine-01', value: 1750, unit: 'RPM' },
    ];

    const res = await fetch(`${baseUrl}/api/telemetry/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.message, 'Bulk telemetry ingested successfully');
    assert.equal(body.data.insertedCount, 3);
    assert.equal(mockStore.length, 3);
  });

  it('POST /api/telemetry/bulk returns 201 for wrapped { records: [...] } object', async () => {
    const payload = {
      records: [
        { sensorId: 'humidity-01', value: 55.4, unit: '%' },
        { sensorId: 'humidity-02', value: 60.1, unit: '%' },
      ],
    };

    const res = await fetch(`${baseUrl}/api/telemetry/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.data.insertedCount, 2);
    assert.equal(mockStore.length, 2);
  });

  it('POST /api/telemetry/bulk returns 400 for empty array', async () => {
    const res = await fetch(`${baseUrl}/api/telemetry/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([]),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.errors.some((e) => e.field === 'records'));
  });

  it('POST /api/telemetry/bulk returns 400 with item details when an item is invalid', async () => {
    const batch = [
      { sensorId: 'temp-01', value: 20 },
      { sensorId: '', value: 30 }, // Missing sensorId at index 1
      { sensorId: 'temp-03', value: 'invalid' }, // Invalid value at index 2
    ];

    const res = await fetch(`${baseUrl}/api/telemetry/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.errors.some((e) => e.field.includes('records[1]')));
    assert.ok(body.errors.some((e) => e.field.includes('records[2]')));
  });

  // --- GET /api/telemetry/:sensorId and :sensorId/latest ---

  it('GET /api/telemetry/:sensorId retrieves telemetry records for sensor', async () => {
    // Ingest sample records
    await fetch(`${baseUrl}/api/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sensorId: 'pressure-01', value: 101.3 }),
    });
    await fetch(`${baseUrl}/api/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sensorId: 'pressure-01', value: 102.5 }),
    });

    const res = await fetch(`${baseUrl}/api/telemetry/pressure-01`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.length, 2);
  });

  it('GET /api/telemetry/:sensorId/latest returns latest document or 404', async () => {
    await fetch(`${baseUrl}/api/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sensorId: 'latest-test-sensor',
        value: 100,
        timestamp: '2026-11-14T05:00:00.000Z',
      }),
    });
    await fetch(`${baseUrl}/api/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sensorId: 'latest-test-sensor',
        value: 200,
        timestamp: '2026-11-14T06:00:00.000Z',
      }),
    });

    const res = await fetch(`${baseUrl}/api/telemetry/latest-test-sensor/latest`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.value, 200);

    // Non-existent sensor returns 404
    const resNotFound = await fetch(`${baseUrl}/api/telemetry/unknown-sensor-xyz/latest`);
    assert.equal(resNotFound.status, 404);
  });
});
