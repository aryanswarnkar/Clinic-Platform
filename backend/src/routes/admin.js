// src/routes/admin.js – Admin-only routes for doctor management
const express = require('express');
const { body, param } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

const router = express.Router();
router.use(authenticate, authorize('ADMIN'));

// GET /api/admin/doctors – list all doctors
router.get('/doctors', adminController.listDoctors);

// POST /api/admin/doctors – create doctor profile
router.post(
  '/doctors',
  [
    body('name').trim().notEmpty(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('specialisation').trim().notEmpty(),
    body('workStartTime').matches(/^\d{2}:\d{2}$/).withMessage('Format HH:MM'),
    body('workEndTime').matches(/^\d{2}:\d{2}$/).withMessage('Format HH:MM'),
    body('slotDurationMins').optional().isInt({ min: 5, max: 120 }),
    body('bio').optional().trim(),
    validate,
  ],
  adminController.createDoctor
);

// PUT /api/admin/doctors/:id – update doctor profile
router.put(
  '/doctors/:id',
  [
    param('id').isUUID(),
    body('specialisation').optional().trim(),
    body('workStartTime').optional().matches(/^\d{2}:\d{2}$/),
    body('workEndTime').optional().matches(/^\d{2}:\d{2}$/),
    body('slotDurationMins').optional().isInt({ min: 5, max: 120 }),
    body('bio').optional().trim(),
    validate,
  ],
  adminController.updateDoctor
);

// DELETE /api/admin/doctors/:id
router.delete('/:id', adminController.deleteDoctor);

// POST /api/admin/doctors/:id/leave – add leave days
router.post(
  '/doctors/:id/leave',
  [
    param('id').isUUID(),
    body('dates').isArray({ min: 1 }).withMessage('dates must be a non-empty array'),
    body('dates.*').isDate().withMessage('Each date must be YYYY-MM-DD'),
    body('reason').optional().trim(),
    validate,
  ],
  adminController.addLeave
);

// DELETE /api/admin/doctors/:id/leave/:leaveId
router.delete('/doctors/:id/leave/:leaveId', adminController.removeLeave);

// GET /api/admin/users – list all users
router.get('/users', adminController.listUsers);

module.exports = router;
