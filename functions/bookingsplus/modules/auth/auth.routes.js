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

/**
 * GET /debug/data — Diagnostic endpoint to inspect datastore state.
 * Shows all Users, UserWorkspaces, Workspaces, and Roles data.
 * Helps debug employee visibility issues by revealing ID mismatches.
 * REMOVE THIS IN PRODUCTION — it exposes all data.
 */
router.get('/debug/data', authMiddleware, asyncHandler(async (req, res) => {
    if (!req.user.is_super_admin) {
        return res.status(403).json({ success: false, message: 'Super admin only.' });
    }

    const { executeZCQL } = require('../../utils/datastore');

    const safeQuery = async (query) => {
        try {
            return await executeZCQL(req, query);
        } catch (e) {
            return [{ error: e.message }];
        }
    };

    const [users, userWorkspaces, workspaces, roles] = await Promise.all([
        safeQuery('SELECT * FROM Users'),
        safeQuery('SELECT * FROM UserWorkspaces'),
        safeQuery('SELECT * FROM Workspaces'),
        safeQuery('SELECT * FROM Roles'),
    ]);

    // Show raw data + the current auth state
    return response.success(res, {
        _authState: {
            'req.user.user_id': req.user.user_id,
            'req.user.ROWID': req.user.ROWID,
            'req.user.email': req.user.email,
            'req.user.is_super_admin': req.user.is_super_admin,
            'X-Workspace-Id_header': req.headers['x-workspace-id'] || '(not set)',
        },
        users: users.map(r => {
            const u = r.Users || r;
            return {
                ROWID: u.ROWID,
                user_id: u.user_id,
                email: u.email,
                display_name: u.display_name,
                catalyst_user_id: u.catalyst_user_id,
                is_super_admin: u.is_super_admin,
                status: u.status,
            };
        }),
        userWorkspaces: userWorkspaces.map(r => {
            const uw = r.UserWorkspaces || r;
            return {
                ROWID: uw.ROWID,
                user_workspace_id: uw.user_workspace_id,
                user_id: uw.user_id,
                workspace_id: uw.workspace_id,
                role_id: uw.role_id,
                status: uw.status,
            };
        }),
        workspaces: workspaces.map(r => {
            const ws = r.Workspaces || r;
            return {
                ROWID: ws.ROWID,
                workspace_id: ws.workspace_id,
                workspace_name: ws.workspace_name,
                workspace_slug: ws.workspace_slug,
                status: ws.status,
            };
        }),
        roles: roles.map(r => {
            const role = r.Roles || r;
            return {
                ROWID: role.ROWID,
                role_name: role.role_name,
                role_level: role.role_level,
                workspace_id: role.workspace_id,
            };
        }),
    });
}));

module.exports = router;
