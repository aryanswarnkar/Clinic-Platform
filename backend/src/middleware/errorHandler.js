// src/middleware/errorHandler.js – Global error handler
const logger = require('../utils/logger');

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // Log server errors
  if (status >= 500) {
    logger.error(`[${req.method} ${req.path}] ${message}`, err);
  }

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

module.exports = { errorHandler };
