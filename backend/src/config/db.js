// src/config/db.js
// MongoDB connection. Mongoose is the ODM used against the team's working
// store (Section 1 / Section 6: "MongoDB as the working data store synced
// to CPGRAMS"). This file is only responsible for the connection lifecycle;
// schemas live in /src/models.

import mongoose from 'mongoose';
import { env } from './env.js';

mongoose.set('strictQuery', true);

export async function connectDB() {
  try {
    const conn = await mongoose.connect(env.mongoUri);
    console.log(`[db] MongoDB connected -> ${conn.connection.host}/${conn.connection.name}`);

    mongoose.connection.on('error', (err) => {
      console.error('[db] connection error after initial connect:', err.message);
    });

    return conn;
  } catch (err) {
    console.error('[db] initial connection failed:', err.message);
    // A backend that can't reach its data store has no business staying up
    // half-alive and returning 500s on every request — fail the boot.
    process.exit(1);
  }
}

export async function disconnectDB() {
  await mongoose.disconnect();
}

export default connectDB;
