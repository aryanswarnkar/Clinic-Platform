// src/jobs/llmQueue.js – Bull queue for LLM summary generation
const Bull = require('bull');
const { getRedisConfig } = require('../config/redis');
const llmService = require('../services/llmService');
const prisma = require('../config/db');
const emailQueue = require('./emailQueue');
const logger = require('../utils/logger');

const llmQueue = new Bull('llm-queue', {
  redis: getRedisConfig(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 10000 },
    removeOnComplete: 30,
    removeOnFail: 50,
  },
});

// ── Pre-Visit Summary ──────────────────────────────────────
llmQueue.process('preVisitSummary', async (job) => {
  const { appointmentId, symptoms, duration, severity, additionalNotes } = job.data;

  logger.info(`Generating pre-visit summary for appointment ${appointmentId}`);

  const result = await llmService.generatePreVisitSummary({
    symptoms, duration, severity, additionalNotes,
  });

  const urgencyMap = { Low: 'LOW', Medium: 'MEDIUM', High: 'HIGH' };
  const urgencyLevel = urgencyMap[result.data.urgencyLevel] || 'UNKNOWN';

  // Upsert summary in DB
  await prisma.summary.upsert({
    where: { appointmentPreId: appointmentId },
    create: {
      appointmentPreId: appointmentId,
      type: 'PRE_VISIT',
      urgencyLevel,
      chiefComplaint: result.data.chiefComplaint,
      suggestedQuestions: result.data.suggestedQuestions || [],
      content: JSON.stringify(result.data),
      status: result.success ? 'done' : 'unavailable',
    },
    update: {
      urgencyLevel,
      chiefComplaint: result.data.chiefComplaint,
      suggestedQuestions: result.data.suggestedQuestions || [],
      content: JSON.stringify(result.data),
      status: result.success ? 'done' : 'unavailable',
    },
  });

  logger.info(`Pre-visit summary stored for appointment ${appointmentId}`);
});

// ── Post-Visit Summary ─────────────────────────────────────
llmQueue.process('postVisitSummary', async (job) => {
  const { appointmentId, doctorNotes, medications, followUpSteps, patientEmail, patientName } = job.data;

  logger.info(`Generating post-visit summary for appointment ${appointmentId}`);

  const result = await llmService.generatePostVisitSummary({
    doctorNotes, medications, followUpSteps,
  });

  await prisma.summary.upsert({
    where: { appointmentPostId: appointmentId },
    create: {
      appointmentPostId: appointmentId,
      type: 'POST_VISIT',
      content: JSON.stringify(result.data),
      status: result.success ? 'done' : 'unavailable',
    },
    update: {
      content: JSON.stringify(result.data),
      status: result.success ? 'done' : 'unavailable',
    },
  });

  // Notify patient that summary is ready
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { doctor: { include: { user: { select: { name: true } } } } },
  });

  if (appointment && patientEmail) {
    emailQueue.add('postVisitSummaryReady', {
      patientEmail,
      patientName,
      doctorName: appointment.doctor.user.name,
    });
  }

  logger.info(`Post-visit summary stored for appointment ${appointmentId}`);
});

// ── Event Handlers ─────────────────────────────────────────
llmQueue.on('failed', (job, err) => {
  logger.error(`LLM job ${job.id} (${job.name}) failed: ${err.message}`);
});

module.exports = llmQueue;
