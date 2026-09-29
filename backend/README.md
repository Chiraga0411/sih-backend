# Nagrik Sahayak — Backend

Node.js / Express / MongoDB backend for **SIH1516: Multilingual Grievance
Lodging & Tracking**, built strictly against the finalized workflow
(`Nagrik Sahayak — Complete Workflow` doc): Gemini-backed AI classification
and translation, MongoDB as the working store synced one-way to CPGRAMS, and
pre-translated templated messaging.

## Folder structure

```
/src
  /config        DB connection, env config (config/db.js, config/env.js)
  /models        Grievance, Citizen, Staff, Department, Template
  /controllers   citizenController, staffController, analyticsController
  /services      aiService, duplicateCheckService, notificationService,
                 cpgramsSyncService, grievanceService (Phase A/B orchestration)
  /routes        citizenRoutes, adminRoutes, analyticsRoutes
  /middlewares   authMiddleware, roleMiddleware, errorHandler
  /jobs          slaTrackerJob, escalationJob
  /templates     messageCatalog.js — pre-translated message catalog
  /utils         AppError, asyncHandler, idGenerator, slaCalculator
scripts/seed.js  departments + staff accounts + templates
server.js        entry point
```

`/src/utils` is a small addition beyond the spec's listed folders, added to
avoid duplicating ID-generation/SLA-math logic across services; everything
else matches the requested architecture exactly.

## Workflow → code map

| Workflow step | Where it lives |
| --- | --- |
| Step 1-2: contact + capture | `citizenController.intake` (text) / `citizenController.intakeVoice` + `POST /citizen/intake/voice` (voice — Bhashini ASR via `aiService.transcribeVoice`); `routes/webhookRoutes.js` (`POST /webhooks/whatsapp`) for the WhatsApp channel itself |
| Step 3: classification + entity extraction | `aiService.classifyComplaint` — calls Gemini when `GEMINI_API_KEY` is configured, else a heuristic fallback |
| Step 4: clarifying question | `aiService.checkMissingFields` + `templates/messageCatalog.js` |
| Step 5: citizen confirmation | `citizenController.intake` response -> client confirms -> `citizenController.submitGrievance` |
| Step 6: duplicate check | `services/duplicateCheckService.js` (`findDuplicate`) — optional embeddings when configured, else Jaccard token-overlap fallback |
| Step 7: ID gen / merge | `utils/idGenerator.js`, `duplicateCheckService.mergeIntoExisting` |
| Step 8: routing + storage + CPGRAMS | `Grievance` model, `services/cpgramsSyncService.js` |
| Step 9: priority triage | `grievanceService.submitGrievance` (urgency -> priorityScore, isUrgentAlert) |
| Step 10: SLA timer starts | `utils/slaCalculator.js` at creation time |
| Step 11: staff dashboard | `controllers/staffController.js`, `routes/adminRoutes.js` |
| Step 12: status update messages | `notificationService.sendTemplatedMessage`, called from `staffController` |
| Step 13: escalation | `jobs/slaTrackerJob.js` + `jobs/escalationJob.js` (initial breach **and** repeat re-escalation of stalled `ESCALATED` tickets — see below) |
| Step 14: resolution + feedback | `citizenController.submitFeedback` |
| Step 15: analytics | `controllers/analyticsController.js` |
| Section 4: admin auth | `staffController.login`, `middlewares/authMiddleware.js`, `middlewares/roleMiddleware.js` |

## Running locally

```bash
cp .env.example .env      # then fill in MONGO_URI / JWT_SECRET at minimum
npm install
npm run seed               # creates departments, 2 staff accounts, templates
npm run dev                 # nodemon, or `npm start` for a plain node run
```

## Gemini AI, voice input & WhatsApp channel

- **Gemini AI** handles voice transcription, multilingual complaint classification, urgency,
  sentiment, landmark/location extraction, and translation through the Gemini
  REST API. Set `GEMINI_API_KEY` in `.env`; no local transformers, PyTorch,
  Hugging Face downloads, or Python AI service are required.
- If Gemini is unavailable or returns invalid data, the backend automatically
  falls back to deterministic keyword classification and pass-through
  translation.
- **Voice intake (Step 2)** — `POST /api/citizen/intake/voice`, multipart
  form-data (`audio` file + `language` + optional `location.lat`/`location.lng`).
  Voice transcription uses the same `GEMINI_API_KEY` through Gemini's
  multimodal `generateContent` endpoint; no separate ASR service is required.
- **WhatsApp channel (Step 1)** — `POST /api/webhooks/whatsapp`, the Twilio
  WhatsApp webhook target. Set `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/
  `TWILIO_WHATSAPP_FROM` in `.env`, then point your Twilio WhatsApp sandbox/
  number's inbound webhook at `https://<your-host>/api/webhooks/whatsapp`.
  Twilio's request signature is verified automatically once `TWILIO_AUTH_TOKEN`
  is set.

Seeded staff logins (**change the password before any real deployment**):

- `admin@nagriksahayak.gov.in` / `ChangeMe123!` (role: `admin`)
- `water.staff@nagriksahayak.gov.in` / `ChangeMe123!` (role: `department_staff`, Water Supply dept)

### Try the citizen flow

```bash
# Step 2-4: classify + check for missing fields
curl -X POST https://sih-backend-01.onrender.com/api/citizen/intake \
  -H "Content-Type: application/json" \
  -d '{"text": "There is a major water leak near MG Road", "language": "en"}'

# Step 5-10: confirmed submission (fill departmentId from the intake response's departmentPreview.id)
curl -X POST https://sih-backend-01.onrender.com/api/citizen/grievances \
  -H "Content-Type: application/json" \
  -d '{
    "text": "There is a major water leak near MG Road",
    "language": "en",
    "channel": "WEB",
    "location": { "lat": 26.9124, "lng": 75.7873 },
    "departmentId": "<paste from intake response>",
    "citizen": { "phone": "+919999999999", "name": "Test Citizen" }
  }'

# Track it
curl https://sih-backend-01.onrender.com/api/citizen/grievances/<complaintId>
```

### Try the staff flow

```bash
TOKEN=$(curl -s -X POST https://sih-backend-01.onrender.com/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@nagriksahayak.gov.in","password":"ChangeMe123!"}' | jq -r .token)

curl https://sih-backend-01.onrender.com/api/admin/grievances -H "Authorization: Bearer $TOKEN"
```

### SLA escalation & re-escalation (Step 13)

`jobs/slaTrackerJob.js` runs on `SLA_CRON_EXPRESSION` (default every 15
min) and does two sweeps per tick:

1. **Breach sweep** (`runSlaSweep`) — any open ticket whose `slaTarget` has
   passed and isn't yet flagged gets `slaBreached = true` and is escalated
   once via `escalationJob.escalateGrievance`.
2. **Re-escalation sweep** (`runReescalationSweep`) — a ticket that's
   already `ESCALATED` but hasn't had *any* further status change for more
   than `SLA_REESCALATION_GRACE_HOURS` (default 24h) gets escalated again:
   `escalationCount` increments, `priorityScore` bumps further, it's
   reassigned to a senior admin, the citizen is re-notified, and CPGRAMS is
   re-synced. This stops a ticket from quietly sitting at "escalated" once
   and then falling through the cracks if the senior officer it landed on
   doesn't act either — every escalation is logged in `statusHistory` so
   the full trail is auditable from `Grievance.escalationCount` /
   `statusHistory`.

Both sweeps are exported directly (not just the cron wrapper), so either
can be triggered on-demand from a test or an admin "run SLA check now"
endpoint without waiting for the schedule.

## What's implemented vs. optional

Real, runnable logic: routing, MongoDB 2dsphere duplicate detection,
JWT auth + bcrypt, RBAC, SLA cron + auto-escalation, aggregation
analytics, templated multilingual messaging with DB override + retry.

The following are optional provider integrations:

- `aiService.transcribeVoice` → an external ASR proxy, only for voice intake
- `duplicateCheckService` → optional embedding service; otherwise Jaccard token overlap is used
- `notificationService.sendViaTwilio` → real Twilio API (currently logs in SIMULATE mode)
- `cpgramsSyncService.syncToCpgrams` → real CPGRAMS API (currently logs in SIMULATE mode)

Gemini classification and translation are implemented directly in
`src/services/aiService.js`. These calls are isolated behind single-purpose
functions and never block the rest of the system when the API is unavailable.
