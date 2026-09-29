// src/middlewares/roleMiddleware.js
// Section 4: "checks the role has permission for that action before
// returning data." Must run AFTER authMiddleware.protect (relies on
// req.staff being populated).

import AppError from '../utils/AppError.js';

/**
 * @param  {...('admin'|'department_staff')} allowedRoles
 */
export function requireRole(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.staff) {
      // Programmer error (route wired wrong) rather than a client error —
      // fail loudly rather than silently allowing/denying.
      return next(new AppError('requireRole used without authMiddleware.protect running first', 500));
    }
    if (!allowedRoles.includes(req.staff.role)) {
      return next(new AppError(`Forbidden: requires one of [${allowedRoles.join(', ')}]`, 403));
    }
    return next();
  };
}

/**
 * department_staff may only act on grievances belonging to their own
 * department; admin bypasses this check entirely. Expects the target
 * grievance's department (an ObjectId) to already be on req.grievance
 * (set by a preceding controller/lookup step).
 */
export function requireOwnDepartmentOrAdmin(req, _res, next) {
  if (req.staff.role === 'admin') return next();

  const grievanceDept = req.grievance?.department?.toString();
  const staffDept = req.staff.department?.toString();
  if (!staffDept || grievanceDept !== staffDept) {
    return next(new AppError('Forbidden: this grievance belongs to a different department', 403));
  }
  return next();
}

export default { requireRole, requireOwnDepartmentOrAdmin };
