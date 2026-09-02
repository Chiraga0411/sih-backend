// server.js
// Entry point: connect to MongoDB, start the Express server, start the
// SLA tracker cron (Step 10/13). Deliberately the only file that has these
// startup side effects — app.js stays importable in isolation for tests.

import { createApp } from './src/app.js';
import { connectDB } from './src/config/db.js';
import { startSlaTrackerJob } from './src/jobs/slaTrackerJob.js';
import env from './src/config/env.js';

async function main() {
  await connectDB();

  const app = createApp();

  const server = app.listen(env.port, () => {
    console.log(`[server] Nagrik Sahayak backend listening on port ${env.port} (${env.nodeEnv})`);
  });

  // Step 10: "A scheduled job (cron / task queue) begins tracking the
  // complaint's age against its SLA resolution window." Started only once
  // the server is up and DB is connected.
  startSlaTrackerJob();

  // Graceful shutdown — let in-flight requests finish, close the HTTP
  // server, then exit. Prevents the process being killed mid-write during
  // deploys/restarts.
  const shutdown = (signal) => {
    console.log(`[server] received ${signal}, shutting down gracefully...`);
    server.close(() => {
      console.log('[server] HTTP server closed.');
      process.exit(0);
    });
    // Force-exit if close() hangs (e.g. a stuck keep-alive connection).
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[server] fatal error during startup:', err);
  process.exit(1);
});
