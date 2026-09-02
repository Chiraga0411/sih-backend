// src/middlewares/errorHandler.js
// Centralized error translation. Every controller/service throws
// AppError (or lets Mongoose/JWT errors bubble up via asyncHandler) and
// this is the single place that turns those into an HTTP response, so
// clients get a consistent { message } shape and stack traces never leak
// in production.

import env from '../config/env.js';

export function notFound(req, _res, next) {
  const err = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  err.statusCode = 404;
  next(err);
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let statusCode = err.statusCode || res.statusCode;
  if (!statusCode || statusCode < 400) statusCode = 500;

  // Translate common Mongoose errors into clean 4xx responses instead of
  // leaking raw driver error shapes.
  let message = err.message;
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join('; ');
  }
  if (err.code === 11000) {
    statusCode = 409;
    message = `Duplicate value for: ${Object.keys(err.keyValue || {}).join(', ')}`;
  }
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for ${err.path}: ${err.value}`;
  }

  console.error(`[error] ${req.method} ${req.originalUrl} -> ${statusCode}: ${message}`);

  res.status(statusCode).json({
    success: false,
    message,
    ...(env.nodeEnv === 'development' ? { stack: err.stack } : {}),
  });
}

export default { notFound, errorHandler };
