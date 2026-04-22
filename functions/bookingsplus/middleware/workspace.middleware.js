/**
 * Workspace Middleware — Resolves the active workspace for the request.
 * 
 * Reads X-Workspace-Id from request headers (set by frontend axios interceptor).
 * Validates the user has an active membership in UserWorkspaces for that workspace.
 * Super admins bypass the membership check.
 * Attaches req.workspaceId and req.userRole to the request.
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

        // Validate user's membership in this workspace
        const userId = req.user.user_id || req.user.ROWID;
        const membershipResult = await executeZCQL(req,
            `SELECT uw.ROWID, uw.role_id, uw.status, r.role_name, r.role_level 
             FROM UserWorkspaces uw 
             LEFT JOIN Roles r ON uw.role_id = r.ROWID 
             WHERE uw.user_id = '${userId}' AND uw.workspace_id = '${workspaceId}'`
        );

        if (membershipResult.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'You do not have access to this workspace.'
            });
        }

        const membership = membershipResult[0];
        const uwData = membership.UserWorkspaces || membership;
        const roleData = membership.Roles || {};

        if (uwData.status === 'suspended') {
            return res.status(403).json({
                success: false,
                message: 'Your access to this workspace has been suspended.'
            });
        }

        req.workspaceId = workspaceId;
        req.workspace = workspace;
        req.userRole = {
            role_id: uwData.role_id,
            role_name: roleData.role_name || 'Staff',
            role_level: parseInt(roleData.role_level) || 0,
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
