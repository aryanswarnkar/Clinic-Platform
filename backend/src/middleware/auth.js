// src/middleware/auth.js – JWT verification + role-based access control
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const { createError } = require('../utils/errors');

/**
 * Verifies the Authorization: Bearer <token> header.
 * Attaches req.user = { id, email, role } on success.
 */
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return next(createError(401, 'Authentication required'));
    }

    const token = header.slice(7);
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return next(createError(401, 'Invalid or expired token'));
    }

    // Verify user still exists in DB
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, name: true },
    });

    if (!user) return next(createError(401, 'User not found'));

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Role guard – pass one or more allowed roles.
 * Usage: authorize('ADMIN'), authorize('DOCTOR', 'ADMIN')
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(createError(401, 'Not authenticated'));
    if (!roles.includes(req.user.role)) {
      return next(createError(403, `Access restricted to: ${roles.join(', ')}`));
    }
    next();
  };
}

module.exports = { authenticate, authorize };
