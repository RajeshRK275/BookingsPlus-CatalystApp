const express = require('express');
const router = express.Router();
const asyncHandler = require('../../core/async-handler');
const response = require('../../core/response');
const authMiddleware = require('../../middleware/auth.middleware');
const authService = require('./auth.service');

/**
 * GET /me — Returns the authenticated user profile with workspaces.
 * 
 * FIRST-TIME SETUP: If the user is a temporary (not yet persisted) user
 * because no Organization exists yet, we return a minimal response with
 * setupCompleted=false so the frontend redirects to the setup page.
 * We do NOT attempt to query workspaces or other tables that require
 * an organization to exist.
 */
router.get('/me', authMiddleware, asyncHandler(async (req, res) => {
    // ── First-time setup scenario ──
    if (req.user._isTemporary) {
        return response.success(res, {
            user: authService.formatUserResponse(req.user),
            workspaces: [],
            setupCompleted: false,
        });
    }

    // ── Normal flow: Run workspace fetch + setup check IN PARALLEL ──
    const userId = req.user.user_id || req.user.ROWID;
    const [workspaces, setupCompleted] = await Promise.all([
        authService.getUserWorkspaces(req, userId),
        authService.isSetupCompleted(req),
    ]);

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
