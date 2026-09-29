// src/routes/adminRoutes.js
// Section 4 — "fully separate surface from the public citizen app —
// never linked from it, with its own login." /auth/login is the only
// unauthenticated route in this file; everything else runs through
// authMiddleware.protect (+ roleMiddleware where a specific role is
// required).

import { Router } from 'express';
import * as staffController from '../controllers/staffController.js';
import * as trustAdminController from '../controllers/trustAdminController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';

const router = Router();

// Section 4: login flow (email + password -> JWT). Unauthenticated by definition.
router.post('/auth/login', staffController.login);

// Everything below requires a valid JWT (Section 4: "Every subsequent
// admin API request includes the JWT").
router.use(protect);

router.get('/me', staffController.me);

// Step 11: view/assign/update complaints. Both roles can view/act on
// their own scope; only admin can assign to an arbitrary staffId (staff
// controller further narrows department_staff to their own department).
router.get('/grievances', requireRole('admin', 'department_staff'), staffController.listGrievances);
router.get('/grievances/:id', requireRole('admin', 'department_staff'), staffController.getGrievanceById);
router.patch('/grievances/:id/assign', requireRole('admin', 'department_staff'), staffController.assignGrievance);
router.patch('/grievances/:id/status', requireRole('admin', 'department_staff'), staffController.updateStatus);

// Anti-spam: flag a grievance (adjusts the submitter's trustScore) and manage the phone blocklist.
router.patch('/grievances/:id/approve', requireRole('admin', 'department_staff'), trustAdminController.approveGrievance);
router.patch('/grievances/:id/flag', requireRole('admin', 'department_staff'), trustAdminController.flagGrievance);
router.get('/blocklist', requireRole('admin'), trustAdminController.listBlocklist);
router.post('/blocklist', requireRole('admin'), trustAdminController.blockPhone);
router.delete('/blocklist/:phone', requireRole('admin'), trustAdminController.unblockPhone);

export default router;
