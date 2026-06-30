// src/jobs/emailQueue.js – Bull queue for email sending with retry + exponential backoff
const Bull = require('bull');
const { getRedisConfig } = require('../config/redis');
const { sendEmail } = require('../services/emailService');
const prisma = require('../config/db');
const logger = require('../utils/logger');

// Queue creation – uses Redis connection config
const emailQueue = new Bull('email-queue', {
  redis: getRedisConfig(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000, // 5s, 10s, 20s
    },
    removeOnComplete: 50,  // keep last 50 completed jobs
    removeOnFail: 100,     // keep last 100 failed jobs for debugging
  },
});

// ── Job Processor ──────────────────────────────────────────
emailQueue.process('bookingConfirmation', async (job) => {
  const { patientEmail, patientName, doctorName, startTime, endTime, appointmentId } = job.data;
  await sendEmail(patientEmail, 'bookingConfirmation', {
    patientName, doctorName, startTime, endTime, appointmentId,
  });
  await logEmailJob(patientEmail, 'Appointment Confirmed', 'DONE');
});

emailQueue.process('appointmentReminder', async (job) => {
  const { patientEmail, patientName, doctorName, startTime, appointmentId } = job.data;
  await sendEmail(patientEmail, 'appointmentReminder', {
    patientName, doctorName, startTime, appointmentId,
  });
  await logEmailJob(patientEmail, 'Appointment Reminder', 'DONE');
});

emailQueue.process('cancellationNotification', async (job) => {
  const { patientEmail, patientName, doctorName, startTime } = job.data;
  await sendEmail(patientEmail, 'cancellationNotification', { patientName, doctorName, startTime });
  await logEmailJob(patientEmail, 'Appointment Cancelled', 'DONE');
});

emailQueue.process('leaveConflictNotification', async (job) => {
  const { patientEmail, patientName, doctorName, appointmentDate, reason, appointmentId } = job.data;
  await sendEmail(patientEmail, 'leaveConflictNotification', {
    patientName, doctorName, appointmentDate, reason, appointmentId,
  });
  await logEmailJob(patientEmail, 'Leave Conflict Notification', 'DONE');
});

emailQueue.process('doctorNewBooking', async (job) => {
  const { doctorEmail, doctorName, patientName, startTime } = job.data;
  await sendEmail(doctorEmail, 'doctorNewBooking', { doctorName, patientName, startTime });
  await logEmailJob(doctorEmail, 'New Booking Notification', 'DONE');
});

emailQueue.process('postVisitSummaryReady', async (job) => {
  const { patientEmail, patientName, doctorName } = job.data;
  await sendEmail(patientEmail, 'postVisitSummaryReady', { patientName, doctorName });
  await logEmailJob(patientEmail, 'Post-Visit Summary Ready', 'DONE');
});

// ── Event Handlers ─────────────────────────────────────────
emailQueue.on('completed', (job) => {
  logger.info(`Email job ${job.id} (${job.name}) completed`);
});

emailQueue.on('failed', async (job, err) => {
  logger.error(`Email job ${job.id} (${job.name}) failed: ${err.message}`);
  if (job.attemptsMade >= job.opts.attempts) {
    // Dead-letter: log final failure to DB
    await logEmailJob(job.data?.patientEmail || job.data?.doctorEmail || 'unknown',
      job.name, 'FAILED', err.message);
    logger.error(`Email job ${job.id} permanently failed after ${job.attemptsMade} attempts`);
  }
});

emailQueue.on('stalled', (job) => {
  logger.warn(`Email job ${job.id} (${job.name}) stalled – will be retried`);
});

// ── Helper ─────────────────────────────────────────────────
async function logEmailJob(toEmail, subject, status, lastError = null) {
  try {
    await prisma.emailJob.create({
      data: {
        toEmail,
        subject,
        bodyHtml: '',
        status,
        lastError,
        ...(status === 'DONE' && { sentAt: new Date() }),
      },
    });
  } catch (err) {
    logger.warn('Failed to log email job to DB', err);
  }
}

module.exports = emailQueue;
