const express = require('express');
const router = express.Router();
const asyncHandler = require('../../core/async-handler');
const response = require('../../core/response');
const { requirePermission } = require('../../middleware/permission.middleware');
const usersService = require('./users.service');

// All routes expect authMiddleware + workspaceMiddleware applied in index.js

router.get('/', requirePermission('users.read'), asyncHandler(async (req, res) => {
    const users = await usersService.getWorkspaceUsers(req);
    return response.success(res, users);
}));

router.post('/', requirePermission('users.create'), asyncHandler(async (req, res) => {
    const result = await usersService.createAndAssign(req, req.body);
    return response.created(res, result);
}));

router.put('/:id', requirePermission('users.update'), asyncHandler(async (req, res) => {
    const updated = await usersService.updateUser(req, req.params.id, req.body);
    return response.success(res, updated);
}));

router.delete('/:id', requirePermission('users.delete'), asyncHandler(async (req, res) => {
    await usersService.removeFromWorkspace(req, req.params.id);
    return response.success(res, null, 'User removed from workspace successfully.');
}));

module.exports = router;
