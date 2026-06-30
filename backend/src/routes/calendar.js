// src/routes/calendar.js – Google Calendar OAuth initiation
const express = require('express');
const { authenticate } = require('../middleware/auth');
const calendarService = require('../services/calendarService');

const router = express.Router();

// GET /api/calendar/auth-url – returns Google OAuth consent page URL
router.get('/auth-url', authenticate, (req, res) => {
  const url = calendarService.getAuthUrl();
  res.json({ url });
});

module.exports = router;
