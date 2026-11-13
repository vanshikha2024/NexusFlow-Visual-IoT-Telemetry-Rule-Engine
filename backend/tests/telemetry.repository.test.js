import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TelemetryRepository } from '../src/repositories/telemetry.repository.js';
import { ApiError } from '../src/utils/apiError.js';

describe('TelemetryRepository (Unit Tests with Test Doubles)', () => {
  // Test double mock factory
  const createMockCollection = (initialData = []) => {
    const store = [...initialData];
    return {
      store,
      insertOne: async (doc) => {
        const _id = `mock_id_${Date.now()}_${Math.random()}`;
        const inserted = { _id, ...doc };
        store.push(inserted);
        return { acknowledged: true, insertedId: _id };
      },
      insertMany: async (docs) => {
        const insertedIds = {};
        docs.forEach((doc, idx) => {
          const _id = `mock_batch_id_${idx}`;
          insertedIds[idx] = _id;
          store.push({ _id, ...doc });
        });
        return {
          acknowledged: true,
          insertedCount: docs.length,
          insertedIds,
        };
      },
      find: (filter) => {
        let results = store.filter((item) => {
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
          sort: (sortObj) => {
            const [sortKey, sortDir] = Object.entries(sortObj)[0] || ['timestamp', -1];
            results.sort((a, b) => {
              const valA = sortKey.includes('.') ? a.metadata?.[sortKey.split('.')[1]] : a[sortKey];
              const valB = sortKey.includes('.') ? b.metadata?.[sortKey.split('.')[1]] : b[sortKey];
              return sortDir === -1 ? (valB > valA ? 1 : -1) : (valA > valB ? 1 : -1);
            });
            return cursor;
          },
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
      findOne: async (filter, options = {}) => {
        const sensorFilter = filter['metadata.sensorId'];
        const matched = store
          .filter((item) => item.metadata?.sensorId === sensorFilter)
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        return matched[0] || null;
      },
    };
  };

  it('insertTelemetry() successfully inserts a normalized document', async () => {
    const mockCollection = createMockCollection();
    const repo = new TelemetryRepository({ collection: mockCollection });

    const input = {
      sensorId: 'turbine-sensor-01',
      sensorType: 'Turbine Sensor',
      timestamp: '2026-11-13T10:00:00.000Z',
      value: 1750.2,
      unit: 'RPM',
      location: 'Turbine Hall A',
    };

    const result = await repo.insertTelemetry(input);

    assert.ok(result._id);
    assert.equal(result.metadata.sensorId, 'turbine-sensor-01');
    assert.equal(result.metadata.sensorType, 'Turbine Sensor');
    assert.equal(result.metadata.location, 'Turbine Hall A');
    assert.equal(result.value, 1750.2);
    assert.equal(result.unit, 'RPM');
    assert.ok(result.timestamp instanceof Date);
    assert.equal(result.timestamp.toISOString(), '2026-11-13T10:00:00.000Z');
    assert.equal(mockCollection.store.length, 1);
  });

  it('insertManyTelemetry() successfully inserts a batch of telemetry records', async () => {
    const mockCollection = createMockCollection();
    const repo = new TelemetryRepository({ collection: mockCollection });

    const batch = [
      { sensorId: 'temp-01', value: 45.2, timestamp: '2026-11-13T10:01:00.000Z' },
      { sensorId: 'temp-01', value: 46.8, timestamp: '2026-11-13T10:02:00.000Z' },
      { sensorId: 'temp-02', value: 31.0, timestamp: '2026-11-13T10:03:00.000Z' },
    ];

    const result = await repo.insertManyTelemetry(batch);

    assert.equal(result.insertedCount, 3);
    assert.equal(Object.keys(result.insertedIds).length, 3);
    assert.equal(result.documents.length, 3);
    assert.equal(mockCollection.store.length, 3);
    assert.ok(result.documents[0].timestamp instanceof Date);
    assert.equal(result.documents[0].metadata.sensorId, 'temp-01');
  });

  it('findTelemetryBySensor() filters by sensor and handles date ranges', async () => {
    const mockCollection = createMockCollection();
    const repo = new TelemetryRepository({ collection: mockCollection });

    await repo.insertTelemetry({
      sensorId: 'vibration-01',
      value: 0.12,
      timestamp: '2026-11-13T08:00:00.000Z',
    });
    await repo.insertTelemetry({
      sensorId: 'vibration-01',
      value: 0.18,
      timestamp: '2026-11-13T09:00:00.000Z',
    });
    await repo.insertTelemetry({
      sensorId: 'vibration-01',
      value: 0.25,
      timestamp: '2026-11-13T10:00:00.000Z',
    });
    await repo.insertTelemetry({
      sensorId: 'other-sensor',
      value: 99.9,
      timestamp: '2026-11-13T09:30:00.000Z',
    });

    // Query all records for vibration-01
    const all = await repo.findTelemetryBySensor('vibration-01');
    assert.equal(all.length, 3);

    // Query with time range
    const filtered = await repo.findTelemetryBySensor('vibration-01', {
      startTime: '2026-11-13T08:30:00.000Z',
      endTime: '2026-11-13T09:30:00.000Z',
    });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].value, 0.18);
  });

  it('getLatestTelemetry() retrieves the most recent record', async () => {
    const mockCollection = createMockCollection();
    const repo = new TelemetryRepository({ collection: mockCollection });

    await repo.insertTelemetry({
      sensorId: 'pressure-01',
      value: 101.3,
      timestamp: '2026-11-13T07:00:00.000Z',
    });
    await repo.insertTelemetry({
      sensorId: 'pressure-01',
      value: 104.5,
      timestamp: '2026-11-13T10:00:00.000Z',
    });
    await repo.insertTelemetry({
      sensorId: 'pressure-01',
      value: 102.1,
      timestamp: '2026-11-13T08:00:00.000Z',
    });

    const latest = await repo.getLatestTelemetry('pressure-01');
    assert.ok(latest);
    assert.equal(latest.value, 104.5);
    assert.equal(latest.timestamp.toISOString(), '2026-11-13T10:00:00.000Z');
  });

  it('handles database connection failure gracefully', async () => {
    // Repository without injected collection attempts to reach getCollection(),
    // which throws ApiError(503) if MongoDB is not connected
    const repo = new TelemetryRepository();

    await assert.rejects(
      async () => {
        await repo.insertTelemetry({ sensorId: 'test-1', value: 10 });
      },
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.statusCode, 503);
        assert.match(err.message, /Database service unavailable/i);
        return true;
      }
    );
  });

  it('rejects invalid inputs with proper errors', async () => {
    const mockCollection = createMockCollection();
    const repo = new TelemetryRepository({ collection: mockCollection });

    // Missing sensorId
    await assert.rejects(
      async () => {
        await repo.insertTelemetry({ value: 100 });
      },
      /missing required sensor identifier/i
    );

    // Empty array in insertMany
    await assert.rejects(
      async () => {
        await repo.insertManyTelemetry([]);
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      }
    );

    // Missing sensorId in getLatestTelemetry
    await assert.rejects(
      async () => {
        await repo.getLatestTelemetry('');
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  });
});
