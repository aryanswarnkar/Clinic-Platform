// src/jobs/scheduler.js – Cron-based scheduled jobs
const cron = require('node-cron');
const { subHours, addDays } = require('date-fns');
const prisma = require('../config/db');
const emailQueue = require('./emailQueue');
const logger = require('../utils/logger');

/**
 * Starts all scheduled background jobs.
 * Called once on server startup.
 */
function startScheduledJobs() {
  // ── 1. Appointment Reminders (runs every hour) ─────────
  // Sends reminder emails 24 hours before each appointment
  cron.schedule('0 * * * *', async () => {
    logger.info('[Cron] Running appointment reminder check');
    try {
      const now = new Date();
      const in24h = addDays(now, 1);
      const windowStart = subHours(in24h, 1); // 23–24 hours from now

      const upcoming = await prisma.appointment.findMany({
        where: {
          status: 'CONFIRMED',
          reminderSent: false,
          startTime: { gte: windowStart, lte: in24h },
        },
        include: {
          patient: { select: { name: true, email: true } },
          doctor: { include: { user: { select: { name: true } } } },
        },
      });

      for (const appt of upcoming) {
        emailQueue.add('appointmentReminder', {
          patientEmail: appt.patient.email,
          patientName: appt.patient.name,
          doctorName: appt.doctor.user.name,
          startTime: appt.startTime,
          appointmentId: appt.id,
        });

        await prisma.appointment.update({
          where: { id: appt.id },
          data: { reminderSent: true },
        });

        logger.info(`Reminder queued for appointment ${appt.id}`);
      }
    } catch (err) {
      logger.error('[Cron] Appointment reminder job failed', err);
    }
  });

  // ── 2. Expired Slot Hold Cleanup (runs every 5 minutes) ─
  cron.schedule('*/5 * * * *', async () => {
    try {
      const result = await prisma.slotHold.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      if (result.count > 0) {
        logger.info(`[Cron] Cleaned up ${result.count} expired slot holds`);
      }
    } catch (err) {
      logger.error('[Cron] Slot hold cleanup failed', err);
    }
  });

  // ── 3. Medication Reminders Scheduler (runs daily at 7 AM) ─
  // Looks at prescriptions from last 30 days and schedules today's reminders
  cron.schedule('0 7 * * *', async () => {
    logger.info('[Cron] Scheduling daily medication reminders');
    try {
      const thirtyDaysAgo = subHours(new Date(), 30 * 24);

      const prescriptions = await prisma.prescription.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        include: {
          appointment: {
            include: { patient: { select: { name: true, email: true } } },
          },
        },
      });

      const medicationQueue = require('./medicationQueue');

      for (const presc of prescriptions) {
        const meds = presc.medications;
        if (!Array.isArray(meds)) continue;

        for (const med of meds) {
          const freq = (med.frequency || '').toLowerCase();
          const remindersToday = [];

          // Schedule based on frequency
          if (freq.includes('once') || freq.includes('daily') || freq.includes('od')) {
            remindersToday.push(0); // send now (7 AM)
          } else if (freq.includes('twice') || freq.includes('bd') || freq.includes('bid')) {
            remindersToday.push(0, 12 * 60 * 60 * 1000); // 7 AM and 7 PM
          } else if (freq.includes('thrice') || freq.includes('tds') || freq.includes('tid')) {
            remindersToday.push(0, 6 * 60 * 60 * 1000, 12 * 60 * 60 * 1000); // 7AM, 1PM, 7PM
          } else {
            remindersToday.push(0); // default: once
          }

          for (const delayMs of remindersToday) {
            medicationQueue.add(
              'sendMedicationReminder',
              {
                patientEmail: presc.appointment.patient.email,
                patientName: presc.appointment.patient.name,
                medication: med,
                appointmentId: presc.appointmentId,
              },
              { delay: delayMs }
            );
          }
        }
      }
    } catch (err) {
      logger.error('[Cron] Medication reminder scheduling failed', err);
    }
  });

  logger.info('All scheduled jobs registered');
}

module.exports = { startScheduledJobs };
