// src/services/emailService.js – Email sending via Nodemailer with retry support
const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for 587
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

// ── Email Templates ────────────────────────────────────────

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long',
    day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const templates = {
  bookingConfirmation: ({ patientName, doctorName, startTime, endTime, appointmentId }) => ({
    subject: '✅ Appointment Confirmed – Clinic Platform',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1976d2;">Appointment Confirmed</h2>
        <p>Dear <strong>${patientName}</strong>,</p>
        <p>Your appointment has been successfully booked.</p>
        <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p><strong>Doctor:</strong> Dr. ${doctorName}</p>
          <p><strong>Date & Time:</strong> ${formatDate(startTime)}</p>
          <p><strong>Duration:</strong> Until ${formatDate(endTime)}</p>
          <p><strong>Reference:</strong> ${appointmentId}</p>
        </div>
        <p>Please arrive 10 minutes early. If you need to cancel or reschedule, please do so at least 24 hours in advance.</p>
        <p style="color: #666; font-size: 12px;">Clinic Platform – Your Health, Our Priority</p>
      </div>
    `,
  }),

  appointmentReminder: ({ patientName, doctorName, startTime, appointmentId }) => ({
    subject: '⏰ Appointment Reminder – Tomorrow',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f57c00;">Appointment Reminder</h2>
        <p>Dear <strong>${patientName}</strong>,</p>
        <p>This is a reminder that you have an appointment tomorrow.</p>
        <div style="background: #fff3e0; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p><strong>Doctor:</strong> Dr. ${doctorName}</p>
          <p><strong>When:</strong> ${formatDate(startTime)}</p>
          <p><strong>Reference:</strong> ${appointmentId}</p>
        </div>
        <p>Please remember to bring any relevant medical records.</p>
      </div>
    `,
  }),

  cancellationNotification: ({ patientName, doctorName, startTime }) => ({
    subject: '❌ Appointment Cancelled',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d32f2f;">Appointment Cancelled</h2>
        <p>Dear <strong>${patientName}</strong>,</p>
        <p>Your appointment with Dr. <strong>${doctorName}</strong> on <strong>${formatDate(startTime)}</strong> has been cancelled.</p>
        <p>You can book a new appointment at your convenience through our platform.</p>
      </div>
    `,
  }),

  leaveConflictNotification: ({ patientName, doctorName, appointmentDate, reason, appointmentId }) => ({
    subject: '⚠️ Important: Your Appointment Has Been Affected',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #e65100;">Appointment Update Required</h2>
        <p>Dear <strong>${patientName}</strong>,</p>
        <p>We regret to inform you that Dr. <strong>${doctorName}</strong> will be unavailable on <strong>${appointmentDate}</strong>${reason ? ` due to: ${reason}` : ''}.</p>
        <p>Your appointment (Ref: <strong>${appointmentId}</strong>) on this date has been cancelled.</p>
        <div style="background: #fff8e1; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #ffa000;">
          <p><strong>What to do next:</strong></p>
          <ul>
            <li>Log in to the platform and book a new slot</li>
            <li>Contact us if you need urgent assistance</li>
          </ul>
        </div>
        <p>We sincerely apologise for this inconvenience.</p>
      </div>
    `,
  }),

  doctorNewBooking: ({ doctorName, patientName, startTime }) => ({
    subject: '📅 New Appointment Booked',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1976d2;">New Appointment</h2>
        <p>Dear Dr. <strong>${doctorName}</strong>,</p>
        <p>A new appointment has been booked with patient <strong>${patientName}</strong> on <strong>${formatDate(startTime)}</strong>.</p>
        <p>Please log in to review the patient's pre-visit symptom summary.</p>
      </div>
    `,
  }),

  postVisitSummaryReady: ({ patientName, doctorName }) => ({
    subject: '📋 Your Post-Visit Summary Is Ready',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #388e3c;">Visit Summary Available</h2>
        <p>Dear <strong>${patientName}</strong>,</p>
        <p>Your post-visit summary from Dr. <strong>${doctorName}</strong> is now available.</p>
        <p>Log in to the platform to view your:</p>
        <ul>
          <li>Visit summary</li>
          <li>Medication schedule</li>
          <li>Follow-up steps</li>
        </ul>
      </div>
    `,
  }),

  medicationReminder: ({ patientName, medicationName, dosage, frequency }) => ({
    subject: `💊 Medication Reminder: ${medicationName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #7b1fa2;">Medication Reminder</h2>
        <p>Dear <strong>${patientName}</strong>,</p>
        <p>This is a reminder to take your medication:</p>
        <div style="background: #f3e5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p><strong>Medication:</strong> ${medicationName}</p>
          <p><strong>Dosage:</strong> ${dosage}</p>
          <p><strong>Frequency:</strong> ${frequency}</p>
        </div>
        <p>Please take your medication as prescribed. If you have concerns, contact your doctor.</p>
      </div>
    `,
  }),
};

// ── Send Function ──────────────────────────────────────────

/**
 * Sends an email using the specified template.
 * @param {string} to - Recipient email
 * @param {string} templateName - Key from templates object
 * @param {object} data - Template variables
 * @throws Error if sending fails (caller handles retries)
 */
async function sendEmail(to, templateName, data) {
  const template = templates[templateName];
  if (!template) throw new Error(`Unknown email template: ${templateName}`);

  const { subject, html } = template(data);
  const transport = getTransporter();

  await transport.sendMail({
    from: process.env.EMAIL_FROM || '"Clinic Platform" <no-reply@clinic.com>',
    to,
    subject,
    html,
  });

  logger.info(`Email sent: ${templateName} → ${to}`);
}

module.exports = { sendEmail };
