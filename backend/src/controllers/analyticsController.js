// src/controllers/analyticsController.js
// Step 15 — "Background Analytics: An admin dashboard (charts and
// structured summaries — resolution time, volume, department performance)
// tracks system health. This is quantitative/visual, not an AI-written
// text digest." Every endpoint here returns plain aggregated numbers for
// the dashboard frontend to chart — no text generation happens server-side.

import Grievance from '../models/Grievance.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * GET /api/analytics/resolution-metrics
 * Average (and median-ish via percentiles) resolution time, overall and
 * per department, computed only over RESOLVED tickets.
 */
export const resolutionMetrics = asyncHandler(async (req, res) => {
  const metrics = await Grievance.aggregate([
    { $match: { status: 'RESOLVED', resolvedAt: { $ne: null } } },
    {
      $project: {
        department: 1,
        resolutionHours: {
          $divide: [{ $subtract: ['$resolvedAt', '$createdAt'] }, 1000 * 60 * 60],
        },
      },
    },
    {
      $group: {
        _id: '$department',
        avgResolutionHours: { $avg: '$resolutionHours' },
        minResolutionHours: { $min: '$resolutionHours' },
        maxResolutionHours: { $max: '$resolutionHours' },
        resolvedCount: { $sum: 1 },
      },
    },
    {
      $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'department' },
    },
    { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        departmentId: '$_id',
        departmentName: '$department.name',
        avgResolutionHours: { $round: ['$avgResolutionHours', 1] },
        minResolutionHours: { $round: ['$minResolutionHours', 1] },
        maxResolutionHours: { $round: ['$maxResolutionHours', 1] },
        resolvedCount: 1,
      },
    },
    { $sort: { avgResolutionHours: 1 } },
  ]);

  res.status(200).json({ success: true, metrics });
});

/**
 * GET /api/analytics/volume-by-department
 * Complaint volume grouped by department and current status — the basic
 * "how busy is each department, and where are things stuck" view.
 */
export const volumeByDepartment = asyncHandler(async (req, res) => {
  const volume = await Grievance.aggregate([
    {
      $group: {
        _id: { department: '$department', status: '$status' },
        count: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: '$_id.department',
        totalCount: { $sum: '$count' },
        byStatus: { $push: { status: '$_id.status', count: '$count' } },
      },
    },
    { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'department' } },
    { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        departmentId: '$_id',
        departmentName: '$department.name',
        totalCount: 1,
        byStatus: 1,
      },
    },
    { $sort: { totalCount: -1 } },
  ]);

  res.status(200).json({ success: true, volume });
});

/**
 * GET /api/analytics/sla-compliance
 * % of resolved tickets that beat their SLA target, plus a live count of
 * currently-open tickets already in breach.
 */
export const slaCompliance = asyncHandler(async (req, res) => {
  const [complianceAgg] = await Grievance.aggregate([
    { $match: { status: 'RESOLVED', resolvedAt: { $ne: null } } },
    {
      $group: {
        _id: null,
        totalResolved: { $sum: 1 },
        withinSla: {
          $sum: { $cond: [{ $lte: ['$resolvedAt', '$slaTarget'] }, 1, 0] },
        },
      },
    },
  ]);

  const currentlyBreached = await Grievance.countDocuments({
    status: { $in: ['LODGED', 'ASSIGNED', 'IN_PROGRESS'] },
    slaBreached: true,
  });

  const totalResolved = complianceAgg?.totalResolved || 0;
  const withinSla = complianceAgg?.withinSla || 0;
  const compliancePct = totalResolved > 0 ? Number(((withinSla / totalResolved) * 100).toFixed(1)) : null;

  res.status(200).json({
    success: true,
    totalResolved,
    resolvedWithinSla: withinSla,
    slaCompliancePercent: compliancePct,
    currentlyOpenAndBreached: currentlyBreached,
  });
});

export default { resolutionMetrics, volumeByDepartment, slaCompliance };
