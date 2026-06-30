// src/services/calendarService.js – Google Calendar API integration
const { google } = require('googleapis');
const logger = require('../utils/logger');

// ── OAuth2 Client ──────────────────────────────────────────
function getOAuth2Client(tokens = null) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  if (tokens) client.setCredentials(tokens);
  return client;
}

/**
 * Step 1: Generate the Google OAuth consent URL.
 * The user clicks this link and authorises the application.
 */
function getAuthUrl() {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar'],
    prompt: 'consent',
  });
}

/**
 * Step 2: Exchange authorisation code for tokens.
 */
async function exchangeCode(code) {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  return tokens;
}

// ── Calendar Operations ────────────────────────────────────

/**
 * Creates calendar events for both patient and doctor.
 * Returns event IDs for storage in CalendarEvent table.
 * Fails gracefully – logs error, does not throw.
 */
async function createCalendarEvents(appointment) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    logger.warn('Google Calendar credentials not configured – skipping event creation');
    return;
  }

  try {
    // NOTE: In production, retrieve stored OAuth tokens from the DB per user.
    // For now we use a service account or application-level credentials.
    // This is a placeholder – see README for full OAuth flow setup.
    const auth = getOAuth2Client();

    const calendar = google.calendar({ version: 'v3', auth });

    const event = {
      summary: `Medical Appointment – Dr. ${appointment.doctor.user.name}`,
      description: `Patient: ${appointment.patient.name}\nDoctor: Dr. ${appointment.doctor.user.name}`,
      start: { dateTime: appointment.startTime.toISOString(), timeZone: 'UTC' },
      end: { dateTime: appointment.endTime.toISOString(), timeZone: 'UTC' },
      attendees: [
        { email: appointment.patient.email },
        { email: appointment.doctor.user.email },
      ],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 24h before
          { method: 'popup', minutes: 30 },
        ],
      },
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      sendUpdates: 'all', // sends invites to attendees
    });

    // Persist event IDs
    await require('../config/db').calendarEvent.upsert({
      where: { appointmentId: appointment.id },
      create: {
        appointmentId: appointment.id,
        patientEventId: response.data.id,
        doctorEventId: response.data.id, // same event, both are attendees
      },
      update: {
        patientEventId: response.data.id,
        doctorEventId: response.data.id,
      },
    });

    logger.info(`Calendar event created: ${response.data.id}`);
    return response.data;
  } catch (err) {
    logger.error('Google Calendar event creation failed', err);
    // Non-fatal – appointment is still valid without calendar event
  }
}

/**
 * Deletes a calendar event (on cancellation).
 */
async function deleteCalendarEvents(calendarEvent) {
  if (!calendarEvent?.patientEventId) return;

  try {
    const auth = getOAuth2Client();
    const calendar = google.calendar({ version: 'v3', auth });

    await calendar.events.delete({
      calendarId: 'primary',
      eventId: calendarEvent.patientEventId,
    });

    logger.info(`Calendar event deleted: ${calendarEvent.patientEventId}`);
  } catch (err) {
    logger.error('Google Calendar event deletion failed', err);
  }
}

module.exports = { getAuthUrl, exchangeCode, createCalendarEvents, deleteCalendarEvents };
