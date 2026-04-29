/**
 * Workspace Middleware — Resolves the active workspace for the request.
 * 
 * Reads X-Workspace-Id from request headers (set by frontend axios interceptor).
 * Validates the user has an active membership in UserWorkspaces for that workspace.
 * Super admins bypass the membership check.
 * Attaches req.workspaceId and req.userRole to the request.
 * 
 * IMPORTANT: Uses SEPARATE queries instead of JOINs to avoid the Catalyst ZCQL
 * "No relationship between tables" error that occurs when table relationships
 * aren't configured in the Data Store settings.
 */
const { executeZCQL } = require('../utils/datastore');

const workspaceMiddleware = async (req, res, next) => {
    try {
        const workspaceId = req.headers['x-workspace-id'];

        if (!workspaceId) {
            return res.status(400).json({
                success: false,
                message: 'Missing X-Workspace-Id header. Select a workspace.'
            });
        }

        // Validate workspace exists and is active
        const wsResult = await executeZCQL(req,
            `SELECT * FROM Workspaces WHERE ROWID = '${workspaceId}'`
        );

        if (wsResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Workspace not found.'
            });
        }

        const workspace = wsResult[0].Workspaces;

        if (workspace.status === 'suspended' || workspace.status === 'archived') {
            return res.status(403).json({
                success: false,
                message: `Workspace "${workspace.workspace_name}" is ${workspace.status}.`
            });
        }

        // Super admins bypass membership check
        if (req.user.is_super_admin) {
            req.workspaceId = workspaceId;
            req.workspace = workspace;
            req.userRole = { role_name: 'Super Admin', role_level: 100, role_id: null };
            return next();
        }

        // ── Validate user's membership using SEPARATE queries (no JOINs) ──
        const userId = req.user.user_id || req.user.ROWID;

        // Step 1: Check UserWorkspaces membership
        let membershipResult;
        try {
            membershipResult = await executeZCQL(req,
                `SELECT * FROM UserWorkspaces WHERE user_id = '${userId}' AND workspace_id = '${workspaceId}'`
            );
        } catch (e) {
            console.error('[WorkspaceMiddleware] Membership query failed:', e.message);
            return res.status(500).json({
                success: false,
                message: 'Failed to verify workspace membership: ' + e.message
            });
        }

        if (membershipResult.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'You do not have access to this workspace.'
            });
        }

        const uwData = membershipResult[0].UserWorkspaces || membershipResult[0];

        if (uwData.status === 'suspended') {
            return res.status(403).json({
                success: false,
                message: 'Your access to this workspace has been suspended.'
            });
        }

        // Step 2: Fetch role details separately if role_id exists
        let roleName = 'Staff';
        let roleLevel = 0;
        if (uwData.role_id) {
            try {
                const roleResult = await executeZCQL(req,
                    `SELECT role_name, role_level FROM Roles WHERE ROWID = '${uwData.role_id}'`
                );
                if (roleResult.length > 0) {
                    const role = roleResult[0].Roles || roleResult[0];
                    roleName = role.role_name || 'Staff';
                    roleLevel = parseInt(role.role_level) || 0;
                }
            } catch (roleErr) {
                console.warn('[WorkspaceMiddleware] Role lookup failed (using defaults):', roleErr.message);
            }
        }

        req.workspaceId = workspaceId;
        req.workspace = workspace;
        req.userRole = {
            role_id: uwData.role_id,
            role_name: roleName,
            role_level: roleLevel,
        };

        next();
    } catch (err) {
        console.error('Workspace middleware error:', err);
        return res.status(500).json({
            success: false,
            message: 'Workspace resolution error: ' + err.message
        });
    }
};

module.exports = workspaceMiddleware;
