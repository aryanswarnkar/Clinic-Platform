// src/services/llmService.js – LLM integration using Google Gemini API
const { GoogleGenAI } = require('@google/genai');
const logger = require('../utils/logger');

let genAI;

function getClient() {
  if (!genAI) {
    genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return genAI;
}

// ── Prompts ────────────────────────────────────────────────

/**
 * PRE-VISIT SUMMARY PROMPT
 * Analyse patient symptoms and return structured clinical brief.
 */
function buildPreVisitPrompt({ symptoms, duration, severity, additionalNotes }) {
  return `You are a medical assistant helping doctors prepare for patient consultations.

Analyse the following patient-reported symptoms and return a structured JSON response.

Patient Information:
- Symptoms: ${symptoms}
- Duration: ${duration || 'Not specified'}
- Severity (1-10 self-rating): ${severity || 'Not specified'}
- Additional Notes: ${additionalNotes || 'None'}

Return ONLY valid JSON in this exact format (no markdown, no code blocks):
{
  "urgencyLevel": "Low",
  "chiefComplaint": "one sentence summary of the main complaint",
  "suggestedQuestions": ["question 1", "question 2", "question 3"],
  "summary": "2-3 paragraph brief for the doctor"
}

urgencyLevel must be exactly one of: "Low", "Medium", or "High"
Base urgency on: High = severe/life-threatening, Medium = significant impact on daily life, Low = mild/manageable.`;
}

/**
 * POST-VISIT SUMMARY PROMPT
 * Convert clinical notes into patient-friendly language.
 */
function buildPostVisitPrompt({ doctorNotes, medications, followUpSteps }) {
  const medList = medications
    .map((m) => `- ${m.name}: ${m.dosage}, ${m.frequency} for ${m.duration}`)
    .join('\n');

  return `You are a medical assistant helping patients understand their visit outcome.

Convert the following clinical notes into a warm, patient-friendly summary that avoids medical jargon.

Doctor's Notes: ${doctorNotes}

Prescribed Medications:
${medList}

Follow-up Steps: ${followUpSteps || 'None specified'}

Return ONLY valid JSON in this exact format (no markdown, no code blocks):
{
  "summary": "2-3 paragraph friendly summary of what happened and next steps",
  "medicationSchedule": [
    {
      "name": "medication name",
      "instructions": "plain-language instructions e.g. Take 1 tablet in the morning with food",
      "duration": "how long to take it"
    }
  ],
  "followUpSteps": ["step 1", "step 2"],
  "warningSignsToWatch": ["sign 1", "sign 2"]
}`;
}

// ── Service Functions ──────────────────────────────────────

/**
 * Generates pre-visit summary using Gemini.
 * On failure: logs error, returns fallback object.
 */
async function generatePreVisitSummary(params) {
  try {
    const client = getClient();
    const prompt = buildPreVisitPrompt(params);

    const response = await client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });

    // Strip markdown code fences if Gemini wraps in ```json ... ```
    let raw = response.text.trim();
    if (raw.startsWith('```')) {
      raw = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    }

    const parsed = JSON.parse(raw);
    logger.info('Pre-visit summary generated successfully via Gemini');
    return { success: true, data: parsed };
  } catch (err) {
    logger.error('Gemini pre-visit summary failed', err);
    return {
      success: false,
      data: {
        urgencyLevel: 'UNKNOWN',
        chiefComplaint: 'Summary generation failed',
        suggestedQuestions: ['Please ask the patient about their symptoms directly'],
        summary: 'AI summary is currently unavailable. Please review patient notes manually.',
      },
    };
  }
}

/**
 * Generates post-visit summary using Gemini.
 * On failure: logs error, returns fallback.
 */
async function generatePostVisitSummary(params) {
  try {
    const client = getClient();
    const prompt = buildPostVisitPrompt(params);

    const response = await client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });

    let raw = response.text.trim();
    if (raw.startsWith('```')) {
      raw = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    }

    const parsed = JSON.parse(raw);
    logger.info('Post-visit summary generated successfully via Gemini');
    return { success: true, data: parsed };
  } catch (err) {
    logger.error('Gemini post-visit summary failed', err);
    return {
      success: false,
      data: {
        summary: 'Your post-visit summary is currently unavailable. Please contact the clinic for details.',
        medicationSchedule: [],
        followUpSteps: ['Contact the clinic for details'],
        warningSignsToWatch: [],
      },
    };
  }
}

module.exports = { generatePreVisitSummary, generatePostVisitSummary };
