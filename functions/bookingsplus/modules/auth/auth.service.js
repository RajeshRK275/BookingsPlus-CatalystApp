/**
 * Auth Service — Business logic for authentication and user context.
 * Separated from route handler for testability and reuse.
 */
const { executeZCQL } = require('../../utils/datastore');
const { TABLES } = require('../../core/constants');

/**
 * Fetches all workspace memberships for a user, with role and workspace details.
 */
const getUserWorkspaces = async (req, userId) => {
    try {
        const wsResult = await executeZCQL(req,
            `SELECT uw.workspace_id, uw.role_id, uw.status, w.workspace_name, w.workspace_slug, w.brand_color, w.logo_url, w.status as ws_status, r.role_name, r.role_level
             FROM ${TABLES.USER_WORKSPACES} uw
             LEFT JOIN ${TABLES.WORKSPACES} w ON uw.workspace_id = w.ROWID
             LEFT JOIN ${TABLES.ROLES} r ON uw.role_id = r.ROWID
             WHERE uw.user_id = '${userId}' AND uw.status = 'active'`
        );
        return wsResult.map(row => ({
            workspace_id: (row.UserWorkspaces || row).workspace_id,
            workspace_name: (row.Workspaces || row).workspace_name,
            workspace_slug: (row.Workspaces || row).workspace_slug,
            brand_color: (row.Workspaces || row).brand_color,
            logo_url: (row.Workspaces || row).logo_url,
            ws_status: (row.Workspaces || row).ws_status || (row.Workspaces || row).status,
            role_name: (row.Roles || row).role_name,
            role_level: (row.Roles || row).role_level,
            role_id: (row.UserWorkspaces || row).role_id,
        }));
    } catch (e) {
        return [];
    }
};

/**
 * Checks if the organization setup has been completed.
 */
const isSetupCompleted = async (req) => {
    try {
        const orgResult = await executeZCQL(req, `SELECT * FROM ${TABLES.ORGANIZATION} LIMIT 1`);
        if (orgResult.length > 0) {
            return orgResult[0].Organization.setup_completed === 'true';
        }
    } catch (e) { /* ignore */ }
    return false;
};

/**
 * Formats the user object for API response (strips internal fields).
 */
const formatUserResponse = (user) => ({
    user_id: user.user_id,
    catalyst_user_id: user.catalyst_user_id,
    email: user.email,
    name: user.name,
    is_super_admin: user.is_super_admin,
    role_version: user.role_version,
    status: user.status,
});

/**
 * Fetches permissions for a user in a specific workspace.
 * Super admins get all permissions.
 */
const getUserPermissions = async (req, user, workspaceId) => {
    if (user.is_super_admin) {
        const allPerms = await executeZCQL(req, `SELECT permission_key FROM ${TABLES.PERMISSIONS}`);
        return {
            permissions: allPerms.map(r => r.Permissions.permission_key),
            is_super_admin: true,
        };
    }

    if (!workspaceId) {
        return { permissions: [], is_super_admin: false };
    }

    const userId = user.user_id || user.ROWID;
    const memberResult = await executeZCQL(req,
        `SELECT role_id FROM ${TABLES.USER_WORKSPACES} 
         WHERE user_id = '${userId}' AND workspace_id = '${workspaceId}' AND status = 'active'`
    );

    if (memberResult.length === 0) {
        return { permissions: [], is_super_admin: false };
    }

    const roleId = memberResult[0].UserWorkspaces.role_id;
    const permResult = await executeZCQL(req,
        `SELECT p.permission_key FROM ${TABLES.ROLE_PERMISSIONS} rp 
         JOIN ${TABLES.PERMISSIONS} p ON rp.permission_id = p.ROWID 
         WHERE rp.role_id = '${roleId}'`
    );

    return {
        permissions: permResult.map(r => (r.Permissions || r).permission_key),
        is_super_admin: false,
    };
};

module.exports = {
    getUserWorkspaces,
    isSetupCompleted,
    formatUserResponse,
    getUserPermissions,
};
