# Nagrik Sahayak — Full Stack

This package contains the connected citizen/admin frontend and the Node.js/MongoDB backend.

## Project structure

```text
frontend/   React + Vite citizen and admin UI
backend/    Express + MongoDB API with Gemini AI integration
```

## Run the backend

```bash
cd backend
cp .env.example .env
# Set MONGO_URI, JWT_SECRET, and GEMINI_API_KEY in backend/.env
npm install
npm run seed
npm run dev
```

The API runs at `https://sih-backend-01.onrender.com`.

The backend loads `backend/.env` automatically. It also supports a `.env` in
the full-stack project root when started from there. Make sure the variables
are written as plain `KEY=value` lines with no spaces around `=`.

## Run the frontend

In a second terminal:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

The frontend is configured to call `https://sih-backend-01.onrender.com/api` through `VITE_API_URL`.

## AI setup

The backend uses the same Gemini API key for voice-to-text, complaint classification, urgency/sentiment detection, landmark extraction, and translation. It does not require Python, PyTorch, Hugging Face, IndicBERT, IndicTrans2, or any local transformer model.

Set:

```env
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash
```

If the Gemini key is not configured or Gemini is unavailable, the backend uses deterministic fallback classification and pass-through translation. Voice transcription returns a clear degraded response and the UI can ask the citizen to use text input.

## Connected API surface

The frontend citizen client calls `/api/citizen/*`, while the admin client calls `/api/admin/*` and `/api/analytics/*`. The backend enables CORS and mounts these exact route prefixes.

Never commit a real `.env` file or production credentials.
