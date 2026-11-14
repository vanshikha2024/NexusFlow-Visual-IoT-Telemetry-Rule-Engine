import { ApiError } from '../utils/apiError.js';

export const notFoundHandler = (req, res, next) => {
  const error = new ApiError(
    404,
    `Route ${req.method} ${req.originalUrl} not found`
  );
  next(error);
};

