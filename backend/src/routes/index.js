import { Router } from 'express';
import healthRoutes from './health.routes.js';
import { ApiResponse } from '../utils/apiResponse.js';

const router = Router();

// Mount health routes at /api/health
router.use('/health', healthRoutes);

// Root API endpoint: /api
router.get('/', (req, res) => {
  ApiResponse.success(
    res,
    {
      name: 'NexusFlow API',
      version: '0.1.0',
      docs: '/api/docs',
      health: '/api/health',
    },
    'Welcome to NexusFlow API'
  );
});

export default router;

