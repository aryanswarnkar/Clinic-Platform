// src/middleware/validate.js – express-validator result checker
const { validationResult } = require('express-validator');

/**
 * Middleware that reads express-validator errors and returns 422 if any exist.
 * Use after your validation chain: [body('field').isEmail(), validate]
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      error: 'Validation failed',
      details: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

module.exports = { validate };
