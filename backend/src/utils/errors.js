// src/utils/errors.js – Typed error factory helpers

/**
 * Creates an error with an HTTP status code attached.
 * @param {number} status
 * @param {string} message
 */
function createError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = 'AppError';
  }
}

module.exports = { createError, AppError };
