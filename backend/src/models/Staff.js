// src/models/Staff.js
// Section 4 — Admin Authentication (Parallel Flow):
// "Staff accounts are stored separately from citizens ... with a role field
// (e.g., admin / department_staff)." Password is bcrypt-hashed, never
// stored or returned in plaintext (see toJSON transform + pre-save hook).

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const staffSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ['admin', 'department_staff'],
      required: true,
      default: 'department_staff',
    },
    // Required for department_staff (their queue is scoped to this dept);
    // optional for admin, who can see/act across all departments.
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.passwordHash;
        return ret;
      },
    },
  }
);

// Instance method used by staffController.login — compares a plaintext
// candidate password against the stored bcrypt hash.
staffSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

// Convenience static for hashing a plaintext password before save/seed.
staffSchema.statics.hashPassword = function hashPassword(plain) {
  const SALT_ROUNDS = 12;
  return bcrypt.hash(plain, SALT_ROUNDS);
};

export const Staff = mongoose.model('Staff', staffSchema);
export default Staff;
