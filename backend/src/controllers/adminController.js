// src/controllers/adminController.js – Admin panel: doctor CRUD + leave management
const bcrypt = require('bcryptjs');
const { parseISO, startOfDay, endOfDay } = require('date-fns');
const prisma = require('../config/db');
const { createError } = require('../utils/errors');
const emailQueue = require('../jobs/emailQueue');
const logger = require('../utils/logger');

// ── GET /api/admin/doctors ─────────────────────────────────
async function listDoctors(req, res, next) {
  try {
    const doctors = await prisma.doctor.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, createdAt: true } },
        leaveDays: { orderBy: { date: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(doctors);
  } catch (err) {
    next(err);
  }
}

// ── POST /api/admin/doctors ────────────────────────────────
async function createDoctor(req, res, next) {
  try {
    const {
      name, email, password, specialisation,
      workStartTime, workEndTime, slotDurationMins = 15, bio,
    } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return next(createError(409, 'Email already registered'));

    const passwordHash = await bcrypt.hash(password, 12);

    const doctor = await prisma.doctor.create({
      data: {
        specialisation,
        workStartTime,
        workEndTime,
        slotDurationMins,
        bio,
        user: {
          create: { email, passwordHash, name, role: 'DOCTOR' },
        },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    res.status(201).json(doctor);
  } catch (err) {
    next(err);
  }
}

// ── PUT /api/admin/doctors/:id ─────────────────────────────
async function updateDoctor(req, res, next) {
  try {
    const { id } = req.params;
    const { specialisation, workStartTime, workEndTime, slotDurationMins, bio } = req.body;

    const doctor = await prisma.doctor.findUnique({ where: { id } });
    if (!doctor) return next(createError(404, 'Doctor not found'));

    const updated = await prisma.doctor.update({
      where: { id },
      data: {
        ...(specialisation && { specialisation }),
        ...(workStartTime && { workStartTime }),
        ...(workEndTime && { workEndTime }),
        ...(slotDurationMins && { slotDurationMins }),
        ...(bio !== undefined && { bio }),
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/admin/doctors/:id ─────────────────────────
async function deleteDoctor(req, res, next) {
  try {
    const doctor = await prisma.doctor.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });
    if (!doctor) return next(createError(404, 'Doctor not found'));

    // Deleting user cascades to doctor due to schema relation
    await prisma.user.delete({ where: { id: doctor.userId } });
    res.json({ message: 'Doctor profile deleted' });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/admin/doctors/:id/leave ─────────────────────
/**
 * Adds leave days and notifies affected patients for each date.
 */
async function addLeave(req, res, next) {
  try {
    const { id: doctorId } = req.params;
    const { dates, reason } = req.body;

    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      include: { user: { select: { name: true } } },
    });
    if (!doctor) return next(createError(404, 'Doctor not found'));

    const created = [];
    for (const dateStr of dates) {
      const date = parseISO(dateStr);

      try {
        const leaveDay = await prisma.leaveDay.create({
          data: { doctorId, date, reason },
        });
        created.push(leaveDay);

        // Find appointments on that day that need to be notified
        const affectedAppointments = await prisma.appointment.findMany({
          where: {
            doctorId,
            status: { in: ['CONFIRMED', 'PENDING'] },
            startTime: { gte: startOfDay(date), lte: endOfDay(date) },
          },
          include: {
            patient: { select: { name: true, email: true } },
          },
        });

        // Notify each affected patient + update appointment
        for (const appt of affectedAppointments) {
          await prisma.appointment.update({
            where: { id: appt.id },
            data: { status: 'CANCELLED' },
          });

          emailQueue.add('leaveConflictNotification', {
            patientEmail: appt.patient.email,
            patientName: appt.patient.name,
            doctorName: doctor.user.name,
            appointmentDate: dateStr,
            reason,
            appointmentId: appt.id,
          });

          logger.info(`Leave conflict: appt ${appt.id} cancelled, patient ${appt.patient.email} notified`);
        }
      } catch (e) {
        if (e.code === 'P2002') {
          // Unique constraint – leave already exists for this date
          logger.warn(`Leave already exists for doctor ${doctorId} on ${dateStr}`);
        } else {
          throw e;
        }
      }
    }

    res.status(201).json({ created, message: `${created.length} leave day(s) added` });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/admin/doctors/:id/leave/:leaveId ───────────
async function removeLeave(req, res, next) {
  try {
    const { leaveId } = req.params;
    const leaveDay = await prisma.leaveDay.findUnique({ where: { id: leaveId } });
    if (!leaveDay) return next(createError(404, 'Leave day not found'));

    await prisma.leaveDay.delete({ where: { id: leaveId } });
    res.json({ message: 'Leave day removed' });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/admin/users ───────────────────────────────────
async function listUsers(req, res, next) {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (err) {
    next(err);
  }
}

module.exports = { listDoctors, createDoctor, updateDoctor, deleteDoctor, addLeave, removeLeave, listUsers };
