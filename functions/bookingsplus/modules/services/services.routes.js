const express = require('express');
const router = express.Router();
const asyncHandler = require('../../core/async-handler');
const response = require('../../core/response');
const { requirePermission } = require('../../middleware/permission.middleware');
const servicesService = require('./services.service');

// All routes expect authMiddleware + workspaceMiddleware applied in index.js

// ─── List all services (with assignedStaff IDs) ───
router.get('/', requirePermission('services.read'), asyncHandler(async (req, res) => {
    const services = await servicesService.getAll(req);
    return response.success(res, services);
}));

// ─── Get single service by ID (with full staff details) ───
router.get('/:id', requirePermission('services.read'), asyncHandler(async (req, res) => {
    const service = await servicesService.getById(req, req.params.id);
    return response.success(res, service);
}));

// ─── Get assigned staff for a service ───
router.get('/:id/staff', requirePermission('services.read'), asyncHandler(async (req, res) => {
    const staff = await servicesService.getServiceStaff(req, req.params.id);
    return response.success(res, staff);
}));

// ─── Create a new service (staff_ids required for non-resource types) ───
router.post('/', requirePermission('services.create'), asyncHandler(async (req, res) => {
    const row = await servicesService.create(req, req.body);
    return response.created(res, row);
}));

// ─── Assign staff to an existing service ───
router.post('/:id/staff', requirePermission('services.update'), asyncHandler(async (req, res) => {
    const { staff_ids } = req.body;
    const result = await servicesService.assignStaff(req, req.params.id, staff_ids);
    return response.success(res, result, 'Staff assigned successfully');
}));

// ─── Replace all staff assignments for a service (bulk update) ───
router.put('/:id/staff', requirePermission('services.update'), asyncHandler(async (req, res) => {
    const { staff_ids } = req.body;
    const result = await servicesService.replaceStaff(req, req.params.id, staff_ids);
    return response.success(res, result, 'Staff assignments updated successfully');
}));

// ─── Update service details ───
router.put('/:id', requirePermission('services.update'), asyncHandler(async (req, res) => {
    const updated = await servicesService.update(req, req.params.id, req.body);
    return response.success(res, updated);
}));

// ─── Unassign staff from a service ───
router.delete('/:id/staff', requirePermission('services.update'), asyncHandler(async (req, res) => {
    const { staff_ids } = req.body;
    const result = await servicesService.unassignStaff(req, req.params.id, staff_ids);
    return response.success(res, result, 'Staff unassigned successfully');
}));

// ─── Delete a service ───
router.delete('/:id', requirePermission('services.delete'), asyncHandler(async (req, res) => {
    await servicesService.remove(req, req.params.id);
    return response.success(res, null, 'Service deleted successfully');
}));

module.exports = router;
