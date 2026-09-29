// src/utils/AppError.js
// A small typed error so controllers/services can throw something the
// central errorHandler middleware knows how to translate into a clean
// HTTP response (status + message) instead of leaking stack traces.

export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // distinguishes "expected" errors from bugs
    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;
