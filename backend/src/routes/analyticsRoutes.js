// src/routes/analyticsRoutes.js
// Step 15 — dashboard analytics. Mounted behind the same admin auth as
// adminRoutes.js; restricted to 'admin' since department_staff shouldn't
// need cross-department performance numbers for their day-to-day queue
// work (adjust to taste — e.g. add department_staff with department-scoped
// results if the frontend needs it).

import { Router } from 'express';
import * as analyticsController from '../controllers/analyticsController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/roleMiddleware.js';

const router = Router();

router.use(protect, requireRole('admin'));

router.get('/resolution-metrics', analyticsController.resolutionMetrics);
router.get('/volume-by-department', analyticsController.volumeByDepartment);
router.get('/sla-compliance', analyticsController.slaCompliance);

export default router;
