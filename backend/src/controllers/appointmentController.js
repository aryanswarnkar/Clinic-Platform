// src/controllers/appointmentController.js – Booking, cancellation, post-visit
const { addMinutes } = require('date-fns');
const prisma = require('../config/db');
const { createError } = require('../utils/errors');
const emailQueue = require('../jobs/emailQueue');
const llmQueue = require('../jobs/llmQueue');
const calendarService = require('../services/calendarService');
const logger = require('../utils/logger');

const HOLD_MINUTES = parseInt(process.env.SLOT_HOLD_MINUTES || '5', 10);

// ── POST /api/appointments/hold ────────────────────────────
/**
 * Creates a temporary slot hold with optimistic concurrency.
 * Uses a DB transaction to atomically:
 *   1. Verify no active booking overlaps the slot
 *   2. Verify no other hold overlaps the slot
 *   3. Insert the hold record
 */
async function holdSlot(req, res, next) {
  try {
    const { doctorId, startTime: startTimeStr } = req.body;
    const patientId = req.user.id;

    const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
    if (!doctor) return next(createError(404, 'Doctor not found'));

    const startTime = new Date(startTimeStr);
    const endTime = addMinutes(startTime, doctor.slotDurationMins);
    const expiresAt = addMinutes(new Date(), HOLD_MINUTES);

    // Atomic hold creation inside a serialisable transaction
    const hold = await prisma.$transaction(async (tx) => {
      // Check for overlapping confirmed/pending appointments
      const conflictAppt = await tx.appointment.findFirst({
        where: {
          doctorId,
          status: { in: ['PENDING', 'CONFIRMED'] },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      });
      if (conflictAppt) throw createError(409, 'Slot already booked');

      // Check for active holds
      const now = new Date();
      const conflictHold = await tx.slotHold.findFirst({
        where: {
          doctorId,
          expiresAt: { gt: now },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      });
      if (conflictHold) throw createError(409, 'Slot is currently held by another user');

      // Check leave
      const leave = await tx.leaveDay.findFirst({
        where: {
          doctorId,
          date: {
            gte: new Date(startTime.toISOString().split('T')[0]),
            lte: new Date(startTime.toISOString().split('T')[0] + 'T23:59:59'),
          },
        },
      });
      if (leave) throw createError(409, 'Doctor is on leave on this date');

      return tx.slotHold.create({
        data: { doctorId, patientId, startTime, endTime, expiresAt },
      });
    }, {
      isolationLevel: 'Serializable',
    });

    res.status(201).json({
      holdId: hold.id,
      startTime: hold.startTime,
      endTime: hold.endTime,
      expiresAt: hold.expiresAt,
    });
  } catch (err) {
    if (err.status) return next(err);
    next(createError(500, err.message));
  }
}

// ── POST /api/appointments ─────────────────────────────────
/**
 * Confirms booking by converting a hold into an appointment.
 * Creates symptom form, triggers LLM pre-visit summary, sends emails,
 * and creates Google Calendar events.
 */
async function createAppointment(req, res, next) {
  try {
    const { holdId, symptoms, duration, severity, additionalNotes } = req.body;
    const patientId = req.user.id;

    // Verify hold is valid and belongs to this patient
    const hold = await prisma.slotHold.findUnique({ where: { id: holdId } });
    if (!hold) return next(createError(404, 'Hold not found'));
    if (hold.patientId !== patientId) return next(createError(403, 'Hold belongs to another user'));
    if (hold.expiresAt < new Date()) return next(createError(410, 'Hold has expired, please start over'));

    // Atomic conversion: hold → appointment + symptom form
    const appointment = await prisma.$transaction(async (tx) => {
      // Double-check no booking slipped in
      const conflict = await tx.appointment.findFirst({
        where: {
          doctorId: hold.doctorId,
          status: { in: ['PENDING', 'CONFIRMED'] },
          startTime: { lt: hold.endTime },
          endTime: { gt: hold.startTime },
        },
      });
      if (conflict) throw createError(409, 'Slot was booked by someone else');

      const appt = await tx.appointment.create({
        data: {
          patientId,
          doctorId: hold.doctorId,
          startTime: hold.startTime,
          endTime: hold.endTime,
          status: 'CONFIRMED',
          symptomForm: {
            create: { symptoms, duration, severity, additionalNotes },
          },
        },
        include: {
          patient: { select: { id: true, name: true, email: true } },
          doctor: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
          symptomForm: true,
        },
      });

      // Remove the hold
      await tx.slotHold.delete({ where: { id: holdId } });
      return appt;
    }, {
      isolationLevel: 'Serializable',
    });

    // ── Background tasks (non-blocking) ─────────────────────
    // 1. LLM pre-visit summary
    llmQueue.add('preVisitSummary', {
      appointmentId: appointment.id,
      symptoms,
      duration,
      severity,
      additionalNotes,
    });

    // 2. Confirmation emails
    emailQueue.add('bookingConfirmation', {
      patientEmail: appointment.patient.email,
      patientName: appointment.patient.name,
      doctorName: appointment.doctor.user.name,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      appointmentId: appointment.id,
    });

    emailQueue.add('doctorNewBooking', {
      doctorEmail: appointment.doctor.user.email,
      doctorName: appointment.doctor.user.name,
      patientName: appointment.patient.name,
      startTime: appointment.startTime,
    });

    // 3. Google Calendar events (best-effort)
    calendarService.createCalendarEvents(appointment).catch((err) =>
      logger.error('Calendar event creation failed', err)
    );

    res.status(201).json(appointment);
  } catch (err) {
    if (err.status) return next(err);
    next(createError(500, err.message));
  }
}

// ── GET /api/appointments ──────────────────────────────────
async function listAppointments(req, res, next) {
  try {
    const { id, role } = req.user;

    let where = {};
    if (role === 'PATIENT') where = { patientId: id };
    else if (role === 'DOCTOR') {
      const doctor = await prisma.doctor.findUnique({ where: { userId: id } });
      if (!doctor) return next(createError(404, 'Doctor profile not found'));
      where = { doctorId: doctor.id };
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        patient: { select: { id: true, name: true, email: true } },
        doctor: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        symptomForm: true,
        preVisitSummary: true,
        postVisitSummary: true,
        prescription: true,
      },
      orderBy: { startTime: 'asc' },
    });

    res.json(appointments);
  } catch (err) {
    next(err);
  }
}

// ── GET /api/appointments/:id ──────────────────────────────
async function getAppointmentById(req, res, next) {
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: req.params.id },
      include: {
        patient: { select: { id: true, name: true, email: true } },
        doctor: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        symptomForm: true,
        preVisitSummary: true,
        postVisitSummary: true,
        prescription: true,
        calendarEvent: true,
      },
    });

    if (!appointment) return next(createError(404, 'Appointment not found'));

    // Authorization: only patient, the doctor, or admin can view
    const { id: userId, role } = req.user;
    const isPatient = appointment.patientId === userId;
    const isDoctor = appointment.doctor.userId === userId;
    if (role !== 'ADMIN' && !isPatient && !isDoctor) {
      return next(createError(403, 'Access denied'));
    }

    res.json(appointment);
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/appointments/:id/cancel ────────────────────
async function cancelAppointment(req, res, next) {
  try {
    const appt = await prisma.appointment.findUnique({
      where: { id: req.params.id },
      include: {
        patient: { select: { id: true, name: true, email: true } },
        doctor: { include: { user: { select: { name: true, email: true } } } },
        calendarEvent: true,
      },
    });
    if (!appt) return next(createError(404, 'Appointment not found'));

    const { id: userId, role } = req.user;
    const isPatient = appt.patientId === userId;
    const isDoctor = appt.doctor.userId === userId;
    if (role !== 'ADMIN' && !isPatient && !isDoctor) {
      return next(createError(403, 'Access denied'));
    }

    if (['CANCELLED', 'COMPLETED'].includes(appt.status)) {
      return next(createError(400, 'Appointment cannot be cancelled'));
    }

    await prisma.appointment.update({
      where: { id: appt.id },
      data: { status: 'CANCELLED' },
    });

    // Notify both parties
    emailQueue.add('cancellationNotification', {
      patientEmail: appt.patient.email,
      patientName: appt.patient.name,
      doctorName: appt.doctor.user.name,
      startTime: appt.startTime,
    });

    // Remove Google Calendar events
    if (appt.calendarEvent) {
      calendarService.deleteCalendarEvents(appt.calendarEvent).catch((err) =>
        logger.error('Calendar event deletion failed', err)
      );
    }

    res.json({ message: 'Appointment cancelled' });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/appointments/:id/post-visit ─────────────────
async function submitPostVisit(req, res, next) {
  try {
    const { id: userId } = req.user;
    const { id: appointmentId } = req.params;
    const { doctorNotes, medications, followUpSteps } = req.body;

    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        doctor: true,
        patient: { select: { id: true, name: true, email: true } },
      },
    });

    if (!appt) return next(createError(404, 'Appointment not found'));
    if (appt.doctor.userId !== userId) return next(createError(403, 'Not your appointment'));
    if (appt.status !== 'CONFIRMED') return next(createError(400, 'Appointment is not in CONFIRMED state'));

    // Create prescription + mark as completed
    const prescription = await prisma.$transaction(async (tx) => {
      const presc = await tx.prescription.create({
        data: {
          appointmentId,
          doctorNotes,
          medications,
          followUpSteps,
        },
      });
      await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: 'COMPLETED' },
      });
      return presc;
    });

    // Queue LLM post-visit summary generation
    llmQueue.add('postVisitSummary', {
      appointmentId,
      doctorNotes,
      medications,
      followUpSteps,
      patientEmail: appt.patient.email,
      patientName: appt.patient.name,
    });

    // Queue medication reminders
    const medicationQueue = require('../jobs/medicationQueue');
    medications.forEach((med) => {
      medicationQueue.add('sendMedicationReminder', {
        patientEmail: appt.patient.email,
        patientName: appt.patient.name,
        medication: med,
        appointmentId,
      });
    });

    res.status(201).json({ message: 'Post-visit notes submitted', prescription });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  holdSlot,
  createAppointment,
  listAppointments,
  getAppointmentById,
  cancelAppointment,
  submitPostVisit,
};
