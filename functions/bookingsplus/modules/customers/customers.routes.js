const express = require('express');
const router = express.Router();
const asyncHandler = require('../../core/async-handler');
const response = require('../../core/response');
const { requirePermission } = require('../../middleware/permission.middleware');
const customersService = require('./customers.service');

// All routes expect authMiddleware + workspaceMiddleware applied in index.js

// GET / — List all customers in workspace
router.get('/', requirePermission('customers.read'), asyncHandler(async (req, res) => {
    const customers = await customersService.getAll(req);
    return response.success(res, customers);
}));

// GET /:id — Get single customer
router.get('/:id', requirePermission('customers.read'), asyncHandler(async (req, res) => {
    const customer = await customersService.getById(req, req.params.id);
    return response.success(res, customer);
}));

// POST / — Create a new customer
router.post('/', requirePermission('customers.create'), asyncHandler(async (req, res) => {
    const result = await customersService.create(req, req.body);
    return response.created(res, result);
}));

// PUT /:id — Update a customer
router.put('/:id', requirePermission('customers.update'), asyncHandler(async (req, res) => {
    const updated = await customersService.update(req, req.params.id, req.body);
    return response.success(res, updated);
}));

// DELETE /:id — Delete a customer
router.delete('/:id', requirePermission('customers.delete'), asyncHandler(async (req, res) => {
    await customersService.remove(req, req.params.id);
    return response.success(res, null, 'Customer deleted successfully.');
}));

module.exports = router;
