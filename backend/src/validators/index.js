import { ApiError } from '../utils/apiError.js';

/**
 * Higher-order middleware to validate incoming request data.
 * @param {Function} validatorFn - Function receiving { body, query, params } and returning { isValid, errors }
 */
export const validate = (validatorFn) => {
  return (req, res, next) => {
    const result = validatorFn({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (result && !result.isValid) {
      return next(
        new ApiError(400, result.message || 'Validation failed', result.errors || [])
      );
    }

    next();
  };
};

export default {
  validate,
};
