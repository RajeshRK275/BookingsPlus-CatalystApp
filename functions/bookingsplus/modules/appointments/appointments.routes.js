const express = require('express');
const router = express.Router();
const asyncHandler = require('../../core/async-handler');
const response = require('../../core/response');
const { requirePermission } = require('../../middleware/permission.middleware');
const appointmentsService = require('./appointments.service');

// All routes expect authMiddleware + workspaceMiddleware applied in index.js

router.get('/', requirePermission('appointments.read'), asyncHandler(async (req, res) => {
    const appointments = await appointmentsService.getAll(req, req.query);
    return response.success(res, appointments);
}));

router.post('/book', requirePermission('appointments.create'), asyncHandler(async (req, res) => {
    const row = await appointmentsService.book(req, req.body);
    return response.created(res, row);
}));

router.put('/:id', requirePermission('appointments.update'), asyncHandler(async (req, res) => {
    const updated = await appointmentsService.update(req, req.params.id, req.body);
    return response.success(res, updated);
}));

router.delete('/:id', requirePermission('appointments.delete'), asyncHandler(async (req, res) => {
    await appointmentsService.remove(req, req.params.id);
    return response.success(res, null, 'Appointment deleted successfully');
}));

module.exports = router;
