// src/routes/doctors.js – Doctor search and availability
const express = require('express');
const { query, param } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const doctorsController = require('../controllers/doctorsController');

const router = express.Router();

// GET /api/doctors – search by specialisation
router.get(
  '/',
  [
    query('specialisation').optional().trim(),
    query('name').optional().trim(),
    validate,
  ],
  doctorsController.listDoctors
);

// GET /api/doctors/:id – doctor profile
router.get('/:id', doctorsController.getDoctorById);

// GET /api/doctors/:id/slots?date=YYYY-MM-DD – available time slots
router.get(
  '/:id/slots',
  [
    param('id').isUUID(),
    query('date').isDate().withMessage('date must be YYYY-MM-DD'),
    validate,
  ],
  authenticate,
  doctorsController.getAvailableSlots
);

module.exports = router;
