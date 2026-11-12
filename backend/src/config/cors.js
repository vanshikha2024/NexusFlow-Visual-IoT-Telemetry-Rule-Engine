import cors from 'cors';
import { env } from './env.js';

/**
 * Allowed origins for Cross-Origin Resource Sharing.
 * Default is configured for the existing Vite + React frontend (http://localhost:5173).
 */
const allowedOrigins = [
  env.FRONTEND_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
].filter(Boolean);

export const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (such as mobile apps, curl, server-to-server)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin) || env.isDevelopment) {
      return callback(null, true);
    }

    return callback(new Error(`Origin ${origin} not allowed by CORS policy.`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400, // 24 hours
};

export const corsMiddleware = cors(corsOptions);
