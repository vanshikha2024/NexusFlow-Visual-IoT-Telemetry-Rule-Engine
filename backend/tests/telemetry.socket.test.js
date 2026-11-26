import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { io as createClient } from 'socket.io-client';
import {
  initializeTelemetrySocket,
  broadcastTelemetry,
  getTelemetrySocket,
} from '../src/services/telemetrySocket.service.js';

test('Socket.IO connects clients and broadcasts single and bulk telemetry', async () => {
  const httpServer = createServer();
  const socketServer = initializeTelemetrySocket(httpServer);
  let client;

  try {
    await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));

    const address = httpServer.address();
    client = createClient(`http://127.0.0.1:${address.port}`, {
      transports: ['websocket'],
      reconnection: false,
    });

    const connectedEvent = once(client, 'telemetry:connected');
    await once(client, 'connect');

    const [connectionPayload] = await connectedEvent;

    assert.equal(connectionPayload.success, true);
    assert.equal(getTelemetrySocket(), socketServer);

    const singleRecord = {
      metadata: { sensorId: 'socket-test-single' },
      value: 25,
    };

    const singleEvent = once(client, 'telemetry:new');

    assert.equal(broadcastTelemetry(singleRecord), true);

    const [receivedSingle] = await singleEvent;
    assert.deepEqual(receivedSingle, singleRecord);

    const bulkRecords = [
      { metadata: { sensorId: 'socket-test-bulk-1' }, value: 30 },
      { metadata: { sensorId: 'socket-test-bulk-2' }, value: 31 },
    ];

    const receivedBulk = [];

    const bulkEventsReceived = new Promise((resolve) => {
      const handler = (record) => {
        receivedBulk.push(record);

        if (receivedBulk.length === bulkRecords.length) {
          client.off('telemetry:new', handler);
          resolve();
        }
      };

      client.on('telemetry:new', handler);
    });

    bulkRecords.forEach(broadcastTelemetry);

    await bulkEventsReceived;
    assert.deepEqual(receivedBulk, bulkRecords);
  } finally {
    if (client) client.disconnect();

    await new Promise((resolve) => socketServer.close(resolve));
  }
});

