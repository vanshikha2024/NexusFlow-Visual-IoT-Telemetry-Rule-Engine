import express from 'express';
import { corsMiddleware } from './config/cors.js';
import { requestLogger } from './middleware/requestLogger.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { errorHandler } from './middleware/errorHandler.js';
import apiRoutes from './routes/index.js';

const app = express();

// Security and CORS middleware
app.use(corsMiddleware);

// Request body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use(requestLogger);

// Mount main API routes under /api
app.use('/api', apiRoutes);

// Root greeting endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    service: 'NexusFlow Backend API',
    version: '0.1.0',
    documentation: '/api',
    health: '/api/health',
  });
});

// 404 handler for invalid routes
app.use(notFoundHandler);

// Centralized error handler
app.use(errorHandler);

export default app;

