// src/routes/auth.js – Authentication routes
const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('role').optional().isIn(['PATIENT', 'DOCTOR']).withMessage('Invalid role'),
    validate,
  ],
  authController.register
);

// POST /api/auth/login
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
    validate,
  ],
  authController.login
);

// GET /api/auth/me – returns current user profile
router.get('/me', authenticate, authController.getMe);

// POST /api/auth/google/callback – Google OAuth callback (for Calendar)
router.post('/google/callback', authenticate, authController.googleOAuthCallback);

module.exports = router;
