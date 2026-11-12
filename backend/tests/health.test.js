import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';

describe('NexusFlow Health and API Endpoints', () => {
  let server;
  let baseUrl;

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('GET /api/health returns 200 with valid health diagnostic JSON', async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);

    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.message, 'NexusFlow service is healthy');
    assert.ok(body.data);
    assert.equal(body.data.status, 'UP');
    assert.equal(body.data.service, 'NexusFlow Backend API');
    assert.equal(typeof body.data.uptimeSeconds, 'number');
    assert.ok(body.data.timestamp);
    assert.ok(body.data.database);
    assert.equal(body.data.database.type, 'MongoDB');
    assert.ok(['connected', 'disconnected', 'connecting'].includes(body.data.database.status));
  });

  it('GET / returns 200 with API service metadata', async () => {
    const response = await fetch(`${baseUrl}/`);
    assert.equal(response.status, 200);

    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.service, 'NexusFlow Backend API');
    assert.equal(body.health, '/api/health');
  });

  it('GET /api/nonexistent-route returns 404 JSON response', async () => {
    const response = await fetch(`${baseUrl}/api/nonexistent-route`);
    assert.equal(response.status, 404);

    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.statusCode, 404);
    assert.match(body.message, /not found/i);
  });

  it('POST /invalid-path returns 404 JSON response', async () => {
    const response = await fetch(`${baseUrl}/invalid-path`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true }),
    });
    assert.equal(response.status, 404);

    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.statusCode, 404);
  });
});
