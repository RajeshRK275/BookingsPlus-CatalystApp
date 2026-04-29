/**
 * Auth Service — Business logic for authentication and user context.
 * Separated from route handler for testability and reuse.
 */
const { executeZCQL } = require('../../utils/datastore');
const { TABLES } = require('../../core/constants');

/**
 * Fetches all workspace memberships for a user, with role and workspace details.
 * Returns empty array for temporary/unresolved users (e.g. during first-time setup).
 * 
 * IMPORTANT: Uses SEPARATE queries instead of JOINs to avoid the Catalyst ZCQL
 * "No relationship between tables" error that occurs when table relationships
 * aren't configured in the Data Store settings.
 */
const getUserWorkspaces = async (req, userId) => {
    // Guard: Don't query workspaces for temporary users that aren't in the DB yet
    if (!userId || String(userId).startsWith('temp-')) {
        return [];
    }

    try {
        // Step 1: Get user's workspace memberships
        const uwResult = await executeZCQL(req,
            `SELECT * FROM ${TABLES.USER_WORKSPACES} WHERE user_id = '${userId}' AND status = 'active'`
        );
        const memberships = uwResult.map(row => row.UserWorkspaces || row);

        if (memberships.length === 0) return [];

        // Step 2: Fetch workspace + role details for ALL memberships IN PARALLEL
        // Each membership needs 1-2 DB calls (workspace + role). Running them
        // concurrently instead of sequentially saves significant latency.
        const workspacePromises = memberships.map(async (membership) => {
            const wsId = membership.workspace_id;
            if (!wsId) return null;

            try {
                // Fetch workspace and role concurrently
                const [wsResult, roleResult] = await Promise.all([
                    executeZCQL(req, `SELECT * FROM ${TABLES.WORKSPACES} WHERE ROWID = '${wsId}'`),
                    membership.role_id
                        ? executeZCQL(req, `SELECT role_name, role_level FROM ${TABLES.ROLES} WHERE ROWID = '${membership.role_id}'`).catch(() => [])
                        : Promise.resolve([]),
                ]);

                if (wsResult.length === 0) return null;
                const ws = wsResult[0].Workspaces || wsResult[0];

                let roleName = 'Staff';
                let roleLevel = 0;
                if (roleResult.length > 0) {
                    const role = roleResult[0].Roles || roleResult[0];
                    roleName = role.role_name || 'Staff';
                    roleLevel = parseInt(role.role_level) || 0;
                }

                return {
                    workspace_id: ws.ROWID,
                    workspace_name: ws.workspace_name,
                    workspace_slug: ws.workspace_slug,
                    brand_color: ws.brand_color,
                    logo_url: ws.logo_url,
                    ws_status: ws.status,
                    role_name: roleName,
                    role_level: roleLevel,
                    role_id: membership.role_id,
                };
            } catch (wsErr) {
                console.warn(`[AuthService] Error fetching workspace ${wsId}:`, wsErr.message);
                return null;
            }
        });

        const results = await Promise.all(workspacePromises);
        return results.filter(Boolean);
    } catch (e) {
        console.warn('[AuthService] getUserWorkspaces failed:', e.message);
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
    name: user.display_name,
    display_name: user.display_name,
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

    // Step 1: Get user's role in this workspace
    let memberResult;
    try {
        memberResult = await executeZCQL(req,
            `SELECT role_id FROM ${TABLES.USER_WORKSPACES} 
             WHERE user_id = '${userId}' AND workspace_id = '${workspaceId}' AND status = 'active'`
        );
    } catch (e) {
        console.warn('[AuthService] getUserPermissions membership query failed:', e.message);
        return { permissions: [], is_super_admin: false };
    }

    if (memberResult.length === 0) {
        return { permissions: [], is_super_admin: false };
    }

    const roleId = (memberResult[0].UserWorkspaces || memberResult[0]).role_id;
    if (!roleId) {
        return { permissions: [], is_super_admin: false };
    }

    // Step 2: Get permission IDs for this role (separate query — no JOIN)
    let rpResult;
    try {
        rpResult = await executeZCQL(req,
            `SELECT permission_id FROM ${TABLES.ROLE_PERMISSIONS} WHERE role_id = '${roleId}'`
        );
    } catch (e) {
        console.warn('[AuthService] getUserPermissions role_permissions query failed:', e.message);
        return { permissions: [], is_super_admin: false };
    }

    if (rpResult.length === 0) {
        return { permissions: [], is_super_admin: false };
    }

    // Step 3: Fetch permission keys for each permission ID
    const permissions = [];
    for (const row of rpResult) {
        const permId = (row.RolePermissions || row).permission_id;
        if (!permId) continue;
        try {
            const permResult = await executeZCQL(req,
                `SELECT permission_key FROM ${TABLES.PERMISSIONS} WHERE ROWID = '${permId}'`
            );
            if (permResult.length > 0) {
                const perm = permResult[0].Permissions || permResult[0];
                if (perm.permission_key) {
                    permissions.push(perm.permission_key);
                }
            }
        } catch (e) {
            // Individual permission lookup failed — skip it
        }
    }

    return {
        permissions,
        is_super_admin: false,
    };
};

module.exports = {
    getUserWorkspaces,
    isSetupCompleted,
    formatUserResponse,
    getUserPermissions,
};
