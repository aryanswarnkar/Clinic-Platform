// src/routes/summaries.js – Summary retrieval routes
const express = require('express');
const { authenticate } = require('../middleware/auth');
const prisma = require('../config/db');
const { createError } = require('../utils/errors');

const router = express.Router();
router.use(authenticate);

// GET /api/summaries/appointment/:appointmentId – get summaries for an appointment
router.get('/appointment/:appointmentId', async (req, res, next) => {
  try {
    const appt = await prisma.appointment.findUnique({
      where: { id: req.params.appointmentId },
      include: {
        doctor: true,
        preVisitSummary: true,
        postVisitSummary: true,
      },
    });

    if (!appt) return next(createError(404, 'Appointment not found'));

    const { id: userId, role } = req.user;
    const isPatient = appt.patientId === userId;
    const isDoctor = appt.doctor.userId === userId;
    if (role !== 'ADMIN' && !isPatient && !isDoctor) {
      return next(createError(403, 'Access denied'));
    }

    // Parse JSON content from DB
    const parseContent = (summary) => {
      if (!summary) return null;
      try {
        return { ...summary, content: JSON.parse(summary.content) };
      } catch {
        return summary;
      }
    };

    res.json({
      preVisit: parseContent(appt.preVisitSummary),
      postVisit: parseContent(appt.postVisitSummary),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
