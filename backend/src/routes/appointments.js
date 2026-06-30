// src/routes/appointments.js – Booking lifecycle routes
const express = require('express');
const { body, param } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const apptController = require('../controllers/appointmentController');

const router = express.Router();
router.use(authenticate);

// POST /api/appointments/hold – reserve a slot for 5 minutes
router.post(
  '/hold',
  [
    body('doctorId').isUUID(),
    body('startTime').isISO8601(),
    validate,
  ],
  apptController.holdSlot
);

// POST /api/appointments – confirm booking with symptom form
router.post(
  '/',
  [
    body('holdId').isUUID().withMessage('holdId required (from /hold)'),
    body('symptoms').trim().notEmpty().withMessage('Symptoms are required'),
    body('duration').optional().trim(),
    body('severity').optional().isInt({ min: 1, max: 10 }),
    body('additionalNotes').optional().trim(),
    validate,
  ],
  authorize('PATIENT'),
  apptController.createAppointment
);

// GET /api/appointments – list my appointments
router.get('/', apptController.listAppointments);

// GET /api/appointments/:id
router.get('/:id', apptController.getAppointmentById);

// PATCH /api/appointments/:id/cancel
router.patch('/:id/cancel', apptController.cancelAppointment);

// POST /api/appointments/:id/post-visit – doctor submits notes + prescription
router.post(
  '/:id/post-visit',
  authorize('DOCTOR'),
  [
    param('id').isUUID(),
    body('doctorNotes').trim().notEmpty(),
    body('medications').isArray({ min: 1 }).withMessage('At least one medication required'),
    body('medications.*.name').trim().notEmpty(),
    body('medications.*.dosage').trim().notEmpty(),
    body('medications.*.frequency').trim().notEmpty(),
    body('medications.*.duration').trim().notEmpty(),
    body('followUpSteps').optional().trim(),
    validate,
  ],
  apptController.submitPostVisit
);

module.exports = router;
