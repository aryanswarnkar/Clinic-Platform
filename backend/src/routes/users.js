// src/routes/users.js – Patient profile management
const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const prisma = require('../config/db');

const router = express.Router();
router.use(authenticate);

// GET /api/users/profile
router.get('/profile', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, name: true, phone: true, role: true, createdAt: true },
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/users/profile
router.patch(
  '/profile',
  [
    body('name').optional().trim().notEmpty(),
    body('phone').optional().trim(),
    validate,
  ],
  async (req, res, next) => {
    try {
      const { name, phone } = req.body;
      const updated = await prisma.user.update({
        where: { id: req.user.id },
        data: { ...(name && { name }), ...(phone !== undefined && { phone }) },
        select: { id: true, email: true, name: true, phone: true, role: true },
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
