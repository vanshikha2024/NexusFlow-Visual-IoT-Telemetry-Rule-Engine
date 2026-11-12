/**
 * Higher-order function to catch async errors and pass them to next()
 * @param {Function} requestHandler - Express route handler
 */
export const asyncHandler = (requestHandler) => {
  return (req, res, next) => {
    Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err));
  };
};
