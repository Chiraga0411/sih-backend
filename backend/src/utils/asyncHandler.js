// src/utils/asyncHandler.js
// Wraps an async Express handler so any rejected promise is forwarded to
// next(err) automatically, which routes it into errorHandler.js. Keeps
// controllers free of repetitive try/catch blocks.

export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
