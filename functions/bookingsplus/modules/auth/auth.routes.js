const express = require('express');
const router = express.Router();
const asyncHandler = require('../../core/async-handler');
const response = require('../../core/response');
const authMiddleware = require('../../middleware/auth.middleware');
const authService = require('./auth.service');

/**
 * GET /me — Returns the authenticated user profile with workspaces.
 */
router.get('/me', authMiddleware, asyncHandler(async (req, res) => {
    const userId = req.user.user_id || req.user.ROWID;
    const workspaces = await authService.getUserWorkspaces(req, userId);
    const setupCompleted = await authService.isSetupCompleted(req);

    return response.success(res, {
        user: authService.formatUserResponse(req.user),
        workspaces,
        setupCompleted,
    });
}));

/**
 * GET /me/permissions — Returns user permissions in the active workspace.
 */
router.get('/me/permissions', authMiddleware, asyncHandler(async (req, res) => {
    const workspaceId = req.headers['x-workspace-id'];
    const result = await authService.getUserPermissions(req, req.user, workspaceId);
    return response.success(res, result);
}));

module.exports = router;
