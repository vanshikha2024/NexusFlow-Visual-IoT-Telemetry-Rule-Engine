import { Server } from 'socket.io';

let io = null;

export const initializeTelemetrySocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    socket.emit('telemetry:connected', {
      success: true,
      message: 'Connected to NexusFlow telemetry stream',
    });

    socket.on('disconnect', () => {
      // Client disconnected.
    });
  });

  return io;
};

export const broadcastTelemetry = (telemetry) => {
  if (!io) return false;

  io.emit('telemetry:new', telemetry);
  return true;
};

export const getTelemetrySocket = () => io;
