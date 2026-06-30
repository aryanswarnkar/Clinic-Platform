// src/controllers/doctorsController.js – Doctor listing and slot availability
const { parseISO, addMinutes, format, isWithinInterval, startOfDay, endOfDay } = require('date-fns');
const prisma = require('../config/db');
const { createError } = require('../utils/errors');

// ── GET /api/doctors ───────────────────────────────────────
async function listDoctors(req, res, next) {
  try {
    const { specialisation, name } = req.query;

    const doctors = await prisma.doctor.findMany({
      where: {
        ...(specialisation && {
          specialisation: { contains: specialisation, mode: 'insensitive' },
        }),
        ...(name && {
          user: { name: { contains: name, mode: 'insensitive' } },
        }),
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { specialisation: 'asc' },
    });

    res.json(doctors);
  } catch (err) {
    next(err);
  }
}

// ── GET /api/doctors/:id ───────────────────────────────────
async function getDoctorById(req, res, next) {
  try {
    const doctor = await prisma.doctor.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!doctor) return next(createError(404, 'Doctor not found'));
    res.json(doctor);
  } catch (err) {
    next(err);
  }
}

// ── GET /api/doctors/:id/slots?date=YYYY-MM-DD ─────────────
/**
 * Returns available time slots for a doctor on a given date.
 * Algorithm:
 *  1. Check if date is a leave day → return [] with message
 *  2. Generate all slots from workStart to workEnd
 *  3. Remove slots that overlap with confirmed/pending appointments
 *  4. Remove slots that are currently held (SlotHold within expiry)
 *  5. Remove past slots
 */
async function getAvailableSlots(req, res, next) {
  try {
    const { id } = req.params;
    const { date } = req.query; // "YYYY-MM-DD"

    const doctor = await prisma.doctor.findUnique({ where: { id } });
    if (!doctor) return next(createError(404, 'Doctor not found'));

    // 1. Check leave days
    const dateObj = parseISO(date);
    const leaveDay = await prisma.leaveDay.findFirst({
      where: {
        doctorId: id,
        date: { gte: startOfDay(dateObj), lte: endOfDay(dateObj) },
      },
    });
    if (leaveDay) {
      return res.json({ available: false, reason: 'Doctor is on leave', slots: [] });
    }

    // 2. Generate all slots
    const [startH, startM] = doctor.workStartTime.split(':').map(Number);
    const [endH, endM] = doctor.workEndTime.split(':').map(Number);
    const slotDuration = doctor.slotDurationMins;

    const dayStart = new Date(dateObj);
    dayStart.setHours(startH, startM, 0, 0);
    const dayEnd = new Date(dateObj);
    dayEnd.setHours(endH, endM, 0, 0);

    const allSlots = [];
    let cursor = dayStart;
    while (addMinutes(cursor, slotDuration) <= dayEnd) {
      allSlots.push({
        startTime: new Date(cursor),
        endTime: addMinutes(cursor, slotDuration),
      });
      cursor = addMinutes(cursor, slotDuration);
    }

    // 3. Fetch existing bookings for the day
    const existingAppointments = await prisma.appointment.findMany({
      where: {
        doctorId: id,
        status: { in: ['PENDING', 'CONFIRMED'] },
        startTime: { gte: startOfDay(dateObj), lte: endOfDay(dateObj) },
      },
    });

    // 4. Fetch active slot holds (not expired)
    const now = new Date();
    const activeHolds = await prisma.slotHold.findMany({
      where: {
        doctorId: id,
        expiresAt: { gt: now },
        startTime: { gte: startOfDay(dateObj), lte: endOfDay(dateObj) },
      },
    });

    // 5. Filter out booked/held/past slots
    const bookedRanges = [
      ...existingAppointments.map((a) => ({ start: a.startTime, end: a.endTime })),
      ...activeHolds.map((h) => ({ start: h.startTime, end: h.endTime })),
    ];

    const availableSlots = allSlots.filter((slot) => {
      if (slot.startTime <= now) return false; // past
      return !bookedRanges.some((range) =>
        slot.startTime < range.end && slot.endTime > range.start
      );
    });

    res.json({
      available: availableSlots.length > 0,
      slots: availableSlots.map((s) => ({
        startTime: s.startTime.toISOString(),
        endTime: s.endTime.toISOString(),
        label: `${format(s.startTime, 'HH:mm')} – ${format(s.endTime, 'HH:mm')}`,
      })),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { listDoctors, getDoctorById, getAvailableSlots };
