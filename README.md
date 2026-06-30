# ClinicCare – Healthcare Appointment Platform

A full-stack clinic management platform with AI-powered pre-visit and post-visit summaries, role-based portals for **Patients**, **Doctors**, and **Admins**, email notifications, Google Calendar integration, and concurrency-safe booking.

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js 20 + Express |
| ORM | Prisma 5 |
| Database | PostgreSQL 16 |
| Frontend | React 18 + Vite 5 + MUI 5 |
| Auth | JWT + bcryptjs |
| Job Queue | Bull + Redis 7 |
| Scheduling | node-cron |
| Email | Nodemailer (SMTP) |
| LLM | OpenAI GPT-4o |
| Calendar | Google Calendar API v3 |
| Logging | Winston |

---

## 🚀 Setup Guide

### Prerequisites

- Node.js 18+, PostgreSQL 15+, Redis 6+
- OpenAI API key
- Gmail/SMTP credentials

### 1. Clone and install

```bash
git clone <repo-url>
cd clinic-platform

cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure environment

```bash
cd backend
cp .env.example .env
# Fill in all values
```

### 3. Set up database

```bash
cd backend
npx prisma migrate dev --name init
npx prisma generate
node prisma/seed.js
```

### 4. Run in development

```bash
# Terminal 1
cd backend && npm run dev      # http://localhost:4000

# Terminal 2
cd frontend && npm run dev     # http://localhost:5173
```

---

## 🐳 Docker Deployment

```bash
cp backend/.env.example .env  # edit with production values
docker-compose up -d --build
```

---

## ☁️ Deployment on Render

### Backend (Web Service)
1. New Web Service → connect repo → root: `backend/`
2. Build: `npm install && npx prisma generate && npx prisma migrate deploy`
3. Start: `npm start`
4. Add env vars, PostgreSQL DB, Redis (Upstash free tier)

### Frontend (Static Site)
1. New Static Site → root: `frontend/`
2. Build: `npm install && npm run build` → Publish: `dist`
3. Set `VITE_API_URL` to backend URL

---

## 🔑 Environment Variables

```env
PORT=4000
NODE_ENV=development
DATABASE_URL="postgresql://user:password@host:5432/clinic_db"
JWT_SECRET=your_super_secret_key_change_this
JWT_EXPIRES_IN=7d
REDIS_URL=redis://localhost:6379
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your_16_char_app_password
EMAIL_FROM="ClinicCare <no-reply@clinic.com>"
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
GOOGLE_REDIRECT_URI=http://localhost:4000/api/auth/google/callback
FRONTEND_URL=http://localhost:5173
SLOT_HOLD_MINUTES=5
```

---

## 📋 API Documentation

### Authentication

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | No | Register patient |
| POST | `/api/auth/login` | No | Login (all roles) |
| GET | `/api/auth/me` | JWT | Get current user |

**POST /api/auth/login**
```json
Request:  { "email": "admin@clinic.com", "password": "Admin@12345" }
Response: { "token": "eyJ...", "user": { "id": "uuid", "role": "ADMIN" } }
```

### Doctors

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/doctors` | No | Search doctors |
| GET | `/api/doctors/:id` | No | Get doctor profile |
| GET | `/api/doctors/:id/slots?date=YYYY-MM-DD` | JWT | Available slots |

**GET /api/doctors/:id/slots?date=2025-09-15**
```json
Response: {
  "available": true,
  "slots": [
    { "startTime": "2025-09-15T09:00:00Z", "endTime": "2025-09-15T09:15:00Z", "label": "09:00 – 09:15" }
  ]
}
```

### Appointments

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/appointments/hold` | PATIENT | Hold slot 5 min |
| POST | `/api/appointments` | PATIENT | Confirm booking |
| GET | `/api/appointments` | JWT | List appointments |
| GET | `/api/appointments/:id` | JWT | Appointment detail |
| PATCH | `/api/appointments/:id/cancel` | JWT | Cancel |
| POST | `/api/appointments/:id/post-visit` | DOCTOR | Submit notes |

**POST /api/appointments/hold**
```json
Request:  { "doctorId": "uuid", "startTime": "2025-09-15T09:00:00Z" }
Response: { "holdId": "uuid", "expiresAt": "2025-09-10T08:05:00Z" }
```

**POST /api/appointments**
```json
Request: {
  "holdId": "uuid",
  "symptoms": "Chest tightness and shortness of breath for 3 days",
  "duration": "3 days", "severity": 7,
  "additionalNotes": "No known drug allergies"
}
Response: { "id": "uuid", "status": "CONFIRMED" }
```

**POST /api/appointments/:id/post-visit**
```json
Request: {
  "doctorNotes": "Patient presents with hypertension. BP 145/90.",
  "medications": [{ "name": "Amlodipine", "dosage": "5mg", "frequency": "Once daily", "duration": "30 days" }],
  "followUpSteps": "Return in 4 weeks"
}
Response: { "message": "Post-visit notes submitted", "prescription": {...} }
```

### Admin (ADMIN role only)

| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/doctors` | List all doctors |
| POST | `/api/admin/doctors` | Create doctor |
| PUT | `/api/admin/doctors/:id` | Update doctor |
| DELETE | `/api/admin/:id` | Delete doctor |
| POST | `/api/admin/doctors/:id/leave` | Add leave days (notifies patients) |
| DELETE | `/api/admin/doctors/:id/leave/:leaveId` | Remove leave |
| GET | `/api/admin/users` | List all users |

### Summaries

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/summaries/appointment/:id` | JWT | Get both summaries |

```json
Response: {
  "preVisit": {
    "urgencyLevel": "MEDIUM",
    "content": { "chiefComplaint": "...", "suggestedQuestions": [...] }
  },
  "postVisit": {
    "content": { "summary": "...", "medicationSchedule": [...] }
  }
}
```

---

## 🗄️ Database Schema

```
User (id, email, passwordHash, name, phone, role)
  └── Doctor (id, userId, specialisation, workStart/EndTime, slotDurationMins, bio)
        ├── LeaveDay (id, doctorId, date, reason)
        └── SlotHold (id, doctorId, patientId, startTime, endTime, expiresAt)

Appointment (id, patientId, doctorId, startTime, endTime, status, reminderSent)
  ├── SymptomForm (id, appointmentId, symptoms, duration, severity, notes)
  ├── Summary [PRE_VISIT] (id, appointmentPreId, urgencyLevel, chiefComplaint, content)
  ├── Summary [POST_VISIT] (id, appointmentPostId, content)
  ├── Prescription (id, appointmentId, doctorNotes, medications:Json)
  └── CalendarEvent (id, appointmentId, patientEventId, doctorEventId)

EmailJob (id, toEmail, subject, status, attempts, lastError)
```

---

## 🤖 LLM Prompts

### Pre-Visit Summary Prompt

```
You are a medical assistant helping doctors prepare for patient consultations.
Analyse the following patient-reported symptoms and return a structured JSON response.

Patient Information:
- Symptoms: <symptoms>
- Duration: <duration>
- Severity (1-10): <severity>
- Additional Notes: <additionalNotes>

Return ONLY valid JSON:
{
  "urgencyLevel": "Low" | "Medium" | "High",
  "chiefComplaint": "one sentence summary",
  "suggestedQuestions": ["q1", "q2", "q3"],
  "summary": "2-3 paragraph brief for the doctor"
}
```

### Post-Visit Summary Prompt

```
You are a medical assistant helping patients understand their visit outcome.
Convert the clinical notes into a warm, patient-friendly summary avoiding jargon.

Doctor's Notes: <doctorNotes>
Prescribed Medications: <medList>
Follow-up Steps: <followUpSteps>

Return ONLY valid JSON:
{
  "summary": "2-3 paragraph friendly summary",
  "medicationSchedule": [{ "name": "...", "instructions": "...", "duration": "..." }],
  "followUpSteps": ["step 1", "step 2"],
  "warningSignsToWatch": ["sign 1", "sign 2"]
}
```

---

## 📅 Google Calendar Setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → Create project
2. Enable **Google Calendar API**
3. **Credentials** → Create OAuth 2.0 Client ID (Web application)
4. Add redirect URI: `http://localhost:4000/api/auth/google/callback`
5. Copy **Client ID** and **Client Secret** to `.env`
6. **OAuth Consent Screen** → add scope: `https://www.googleapis.com/auth/calendar`
7. In app: GET `/api/calendar/auth-url` → user grants access → POST `/api/auth/google/callback` with code

---

## 🧑‍💻 Demo Credentials

| Role | Email | Password |
|---|---|---|
| Admin | admin@clinic.com | Admin@12345 |
| Doctor | sarah.mitchell@clinic.com | Doctor@12345 |
| Patient | john.doe@example.com | Patient@12345 |

---

## 🌐 Hosted Application

**Placeholder**: `https://clinic-platform.onrender.com`

Deploy following the Render instructions above. Free tier services spin down after 15 minutes of inactivity.
