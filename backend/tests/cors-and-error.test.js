import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';

describe('CORS and Error Handling', () => {
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

  it('handles CORS headers correctly for frontend origin', async () => {
    const response = await fetch(`${baseUrl}/api/health`, {
      method: 'GET',
      headers: {
        Origin: 'http://localhost:5173',
      },
    });

    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get('access-control-allow-origin'),
      'http://localhost:5173'
    );
    assert.equal(
      response.headers.get('access-control-allow-credentials'),
      'true'
    );
  });

  it('handles OPTIONS preflight request from frontend origin', async () => {
    const response = await fetch(`${baseUrl}/api/health`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'GET',
      },
    });

    assert.equal(response.status, 204);
    assert.equal(
      response.headers.get('access-control-allow-origin'),
      'http://localhost:5173'
    );
  });
});
