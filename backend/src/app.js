// src/app.js
// Express app assembly: middleware, route mounting, error handling. Kept
// separate from server.js so the app itself (without DB connection / cron
// startup side effects) can be imported directly in tests (e.g. supertest).

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import citizenRoutes from './routes/citizenRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';
import { notFound, errorHandler } from './middlewares/errorHandler.js';
import env from './config/env.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors()); // tighten to an explicit origin allowlist before production launch
  app.use(express.json({ limit: '1mb' }));
  // Twilio webhooks POST application/x-www-form-urlencoded, not JSON.
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  if (env.nodeEnv !== 'test') {
    app.use(morgan(env.nodeEnv === 'development' ? 'dev' : 'combined'));
  }

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'nagrik-sahayak-backend', time: new Date().toISOString() });
  });

  // Phase A/B/C citizen touchpoints (Steps 1-10, 14) — public, no auth.
  app.use('/api/citizen', citizenRoutes);

  // Step 1 — WhatsApp inbound channel (Twilio webhook). Public by
  // necessity (Twilio can't send a JWT); protected instead by Twilio
  // request-signature validation inside the route (see webhookRoutes.js).
  app.use('/api/webhooks', webhookRoutes);

  // Section 4 + Phase C staff/admin surface (Steps 11-13) — JWT-protected.
  app.use('/api/admin', adminRoutes);

  // Step 15 — dashboard analytics aggregations.
  app.use('/api/analytics', analyticsRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
