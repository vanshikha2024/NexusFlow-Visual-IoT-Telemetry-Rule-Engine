import { HealthService } from '../services/health.service.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getHealth = asyncHandler(async (req, res) => {
  const healthData = HealthService.getHealthStatus();
  return ApiResponse.success(res, healthData, 'NexusFlow service is healthy');
});
