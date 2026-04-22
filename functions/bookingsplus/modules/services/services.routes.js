const express = require('express');
const router = express.Router();
const asyncHandler = require('../../core/async-handler');
const response = require('../../core/response');
const { requirePermission } = require('../../middleware/permission.middleware');
const servicesService = require('./services.service');

// All routes expect authMiddleware + workspaceMiddleware applied in index.js

router.get('/', requirePermission('services.read'), asyncHandler(async (req, res) => {
    const services = await servicesService.getAll(req);
    return response.success(res, services);
}));

router.post('/', requirePermission('services.create'), asyncHandler(async (req, res) => {
    const row = await servicesService.create(req, req.body);
    return response.created(res, row);
}));

router.put('/:id', requirePermission('services.update'), asyncHandler(async (req, res) => {
    const updated = await servicesService.update(req, req.params.id, req.body);
    return response.success(res, updated);
}));

router.delete('/:id', requirePermission('services.delete'), asyncHandler(async (req, res) => {
    await servicesService.remove(req, req.params.id);
    return response.success(res, null, 'Service deleted successfully');
}));

module.exports = router;
