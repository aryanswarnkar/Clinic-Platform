// src/jobs/medicationQueue.js – Bull queue for medication reminders
const Bull = require('bull');
const { getRedisConfig } = require('../config/redis');
const { sendEmail } = require('../services/emailService');
const logger = require('../utils/logger');

const medicationQueue = new Bull('medication-queue', {
  redis: getRedisConfig(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

// ── Job Processor ──────────────────────────────────────────
/**
 * Processes medication reminder jobs.
 * The scheduler (scheduler.js) creates delayed jobs based on frequency.
 */
medicationQueue.process('sendMedicationReminder', async (job) => {
  const { patientEmail, patientName, medication } = job.data;
  const { name: medicationName, dosage, frequency } = medication;

  await sendEmail(patientEmail, 'medicationReminder', {
    patientName,
    medicationName,
    dosage,
    frequency,
  });

  logger.info(`Medication reminder sent to ${patientEmail} for ${medicationName}`);
});

medicationQueue.on('failed', (job, err) => {
  logger.error(`Medication reminder job ${job.id} failed: ${err.message}`);
});

module.exports = medicationQueue;
