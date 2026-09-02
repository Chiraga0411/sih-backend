// src/controllers/staffController.js
// Section 4 (login/JWT issuance) + Step 11/12 (staff working the queue,
// status transitions triggering templated notifications). Every route
// using these (besides `login`) is mounted behind authMiddleware.protect
// + roleMiddleware in routes/adminRoutes.js.

import jwt from 'jsonwebtoken';
import Staff from '../models/Staff.js';
import Grievance from '../models/Grievance.js';
import env from '../config/env.js';
import asyncHandler from '../utils/asyncHandler.js';
import AppError from '../utils/AppError.js';
import { sendTemplatedMessage } from '../services/notificationService.js';

const STATUS_TEMPLATE_KEY = {
  ASSIGNED: 'STATUS_ASSIGNED',
  IN_PROGRESS: 'STATUS_IN_PROGRESS',
  RESOLVED: 'STATUS_RESOLVED',
};

function issueToken(staff) {
  return jwt.sign({ sub: staff.id, role: staff.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

/**
 * POST /api/admin/auth/login
 * Section 4: "Login flow: staff enters email + password -> backend
 * verifies against a bcrypt-hashed password -> issues a JWT on success."
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new AppError('email and password are required', 400);
  }

  const staff = await Staff.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!staff || !staff.isActive) {
    throw new AppError('Invalid credentials', 401); // don't leak whether the email exists
  }

  const valid = await staff.comparePassword(password);
  if (!valid) {
    throw new AppError('Invalid credentials', 401);
  }

  const token = issueToken(staff);
  res.status(200).json({
    success: true,
    token,
    staff: { id: staff.id, name: staff.name, email: staff.email, role: staff.role, department: staff.department },
  });
});

/**
 * GET /api/admin/me — quick "am I logged in, and as who" check for the
 * dashboard frontend on load.
 */
export const me = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, staff: req.staff });
});

/**
 * GET /api/admin/grievances
 * Step 11: "Staff log in ... to view, assign, and update complaints."
 * department_staff is auto-scoped to their own department; admin can see
 * everything or filter via query params.
 */
export const listGrievances = asyncHandler(async (req, res) => {
  const { status, department, page = 1, limit = 20 } = req.query;

  const filter = {};
  if (status) filter.status = status;

  if (req.staff.role === 'department_staff') {
    filter.department = req.staff.department;
  } else if (department) {
    filter.department = department;
  }

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(100, Math.max(1, Number(limit)));

  const [items, total] = await Promise.all([
    Grievance.find(filter)
      .populate('department', 'name code')
      .populate('assignedStaff', 'name email')
      .sort({ priorityScore: -1, createdAt: 1 }) // highest priority, oldest first
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    Grievance.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    page: pageNum,
    limit: limitNum,
    total,
    items,
  });
});

/**
 * GET /api/admin/grievances/:id
 */
export const getGrievanceById = asyncHandler(async (req, res) => {
  const grievance = await Grievance.findById(req.params.id)
    .populate('department', 'name code')
    .populate('assignedStaff', 'name email')
    .populate('citizen', 'phone name preferredLanguage');

  if (!grievance) throw new AppError('Grievance not found', 404);

  if (req.staff.role === 'department_staff' && grievance.department._id.toString() !== req.staff.department?.toString()) {
    throw new AppError('Forbidden: this grievance belongs to a different department', 403);
  }

  res.status(200).json({ success: true, grievance });
});

/**
 * PATCH /api/admin/grievances/:id/assign
 * Step 11 — assigning moves LODGED -> ASSIGNED and triggers Step 12's
 * templated notification.
 */
export const assignGrievance = asyncHandler(async (req, res) => {
  const { staffId } = req.body;
  const grievance = await Grievance.findById(req.params.id).populate('citizen').populate('department', 'name');
  if (!grievance) throw new AppError('Grievance not found', 404);

  if (req.staff.role === 'department_staff' && grievance.department._id.toString() !== req.staff.department?.toString()) {
    throw new AppError('Forbidden: this grievance belongs to a different department', 403);
  }
  if (!['LODGED', 'ESCALATED'].includes(grievance.status)) {
    throw new AppError(`Cannot assign a grievance in status ${grievance.status}`, 409);
  }

  const assignee = await Staff.findById(staffId || req.staff.id);
  if (!assignee) throw new AppError('Target staff member not found', 404);

  grievance.assignedStaff = assignee._id;
  grievance.status = 'ASSIGNED';
  grievance.statusHistory.push({ status: 'ASSIGNED', timestamp: new Date(), updatedBy: req.staff.id });
  await grievance.save();

  const notifyResult = await sendTemplatedMessage(
    grievance.citizen,
    STATUS_TEMPLATE_KEY.ASSIGNED,
    { complaintId: grievance.complaintId, department: grievance.department.name },
    grievance.language
  );

  res.status(200).json({ success: true, grievance, notification: notifyResult });
});

/**
 * PATCH /api/admin/grievances/:id/status
 * Step 12 — every transition here fires the matching pre-translated
 * template. Enforces the pipeline's forward-only transitions.
 */
const ALLOWED_TRANSITIONS = {
  ASSIGNED: ['IN_PROGRESS'],
  IN_PROGRESS: ['RESOLVED'],
  ESCALATED: ['IN_PROGRESS', 'RESOLVED'],
};

export const updateStatus = asyncHandler(async (req, res) => {
  const { status: nextStatus, note } = req.body;
  if (!['IN_PROGRESS', 'RESOLVED'].includes(nextStatus)) {
    throw new AppError('status must be IN_PROGRESS or RESOLVED', 400);
  }

  const grievance = await Grievance.findById(req.params.id).populate('citizen').populate('department', 'name');
  if (!grievance) throw new AppError('Grievance not found', 404);

  if (req.staff.role === 'department_staff' && grievance.department._id.toString() !== req.staff.department?.toString()) {
    throw new AppError('Forbidden: this grievance belongs to a different department', 403);
  }

  const allowedNext = ALLOWED_TRANSITIONS[grievance.status] || [];
  if (!allowedNext.includes(nextStatus)) {
    throw new AppError(`Cannot move from ${grievance.status} to ${nextStatus}`, 409);
  }

  grievance.status = nextStatus;
  grievance.statusHistory.push({ status: nextStatus, timestamp: new Date(), updatedBy: req.staff.id, note });
  if (nextStatus === 'RESOLVED') {
    grievance.resolvedAt = new Date();
  }
  await grievance.save();

  const notifyResult = await sendTemplatedMessage(
    grievance.citizen,
    STATUS_TEMPLATE_KEY[nextStatus],
    { complaintId: grievance.complaintId, department: grievance.department.name },
    grievance.language
  );

  // Step 14 follow-up: nudge for feedback right after resolution.
  if (nextStatus === 'RESOLVED') {
    await sendTemplatedMessage(grievance.citizen, 'FEEDBACK_REQUEST', { complaintId: grievance.complaintId }, grievance.language);
  }

  res.status(200).json({ success: true, grievance, notification: notifyResult });
});

export default { login, me, listGrievances, getGrievanceById, assignGrievance, updateStatus };
