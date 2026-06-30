// src/controllers/authController.js – Registration, login, profile
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const { createError } = require('../utils/errors');

// ── Helper ─────────────────────────────────────────────────
function signToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

// ── POST /api/auth/register ────────────────────────────────
async function register(req, res, next) {
  try {
    const { email, password, name, phone, role = 'PATIENT' } = req.body;

    // Check duplicate
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return next(createError(409, 'Email already registered'));

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { email, passwordHash, name, phone, role },
      select: { id: true, email: true, name: true, role: true },
    });

    const token = signToken(user.id);
    res.status(201).json({ token, user });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/auth/login ───────────────────────────────────
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return next(createError(401, 'Invalid credentials'));

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return next(createError(401, 'Invalid credentials'));

    const token = signToken(user.id);
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/auth/me ───────────────────────────────────────
async function getMe(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, email: true, name: true, phone: true, role: true, createdAt: true,
        doctor: {
          select: {
            id: true, specialisation: true, workStartTime: true, workEndTime: true,
            slotDurationMins: true, bio: true,
          },
        },
      },
    });
    if (!user) return next(createError(404, 'User not found'));
    res.json(user);
  } catch (err) {
    next(err);
  }
}

// ── POST /api/auth/google/callback ─────────────────────────
async function googleOAuthCallback(req, res, next) {
  try {
    const { code } = req.body;
    if (!code) return next(createError(400, 'Missing OAuth code'));

    const calendarService = require('../services/calendarService');
    const tokens = await calendarService.exchangeCode(code);

    res.json({ message: 'Google Calendar connected', tokens });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, getMe, googleOAuthCallback };
