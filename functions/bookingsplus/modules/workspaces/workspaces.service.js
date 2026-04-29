/**
 * Workspaces Service — Business logic for workspace management.
 * 
 * IMPORTANT: Catalyst ZCQL JOINs require explicit table relationships to be
 * configured in the Data Store settings (Data Store → Relationships).
 * If those relationships are missing, JOIN queries fail with:
 *   "No relationship between tables X and Y"
 * 
 * To avoid this hard dependency, we use SEPARATE queries instead of JOINs.
 * This is slightly less efficient but 100% reliable regardless of whether
 * the admin has configured table relationships in the Catalyst console.
 */
const { executeZCQL } = require('../../utils/datastore');
const { TABLES } = require('../../core/constants');

const getMyWorkspaces = async (req) => {
    const userId = req.user.user_id || req.user.ROWID;

    // Super admins see all active workspaces
    if (req.user.is_super_admin) {
        try {
            const allWs = await executeZCQL(req, `SELECT * FROM ${TABLES.WORKSPACES} WHERE status = 'active'`);
            return allWs.map(row => {
                const ws = row.Workspaces || row;
                return {
                    workspace_id: ws.ROWID,
                    workspace_name: ws.workspace_name,
                    workspace_slug: ws.workspace_slug,
                    brand_color: ws.brand_color,
                    logo_url: ws.logo_url,
                    status: ws.status,
                    role_name: 'Super Admin',
                    role_level: 100,
                };
            });
        } catch (err) {
            console.warn('[WorkspacesService] Error fetching workspaces for super admin:', err.message);
            // Table might be empty or missing — return empty array (not an error)
            return [];
        }
    }

    // ── Regular users: fetch memberships using SEPARATE queries ──
    // Step 1: Get user's workspace memberships from UserWorkspaces
    let memberships = [];
    try {
        const uwResult = await executeZCQL(req,
            `SELECT * FROM ${TABLES.USER_WORKSPACES} WHERE user_id = '${userId}' AND status = 'active'`
        );
        memberships = uwResult.map(row => row.UserWorkspaces || row);
    } catch (err) {
        console.warn('[WorkspacesService] Error fetching user workspace memberships:', err.message);
        return [];
    }

    if (memberships.length === 0) return [];

    // Step 2: Fetch workspace details for each membership
    const workspaces = [];
    for (const membership of memberships) {
        const wsId = membership.workspace_id;
        if (!wsId) continue;

        try {
            const wsResult = await executeZCQL(req,
                `SELECT * FROM ${TABLES.WORKSPACES} WHERE ROWID = '${wsId}' AND status = 'active'`
            );
            if (wsResult.length === 0) continue;

            const ws = wsResult[0].Workspaces || wsResult[0];

            // Step 3: Fetch role details if role_id exists
            let roleName = 'Staff';
            let roleLevel = 0;
            if (membership.role_id) {
                try {
                    const roleResult = await executeZCQL(req,
                        `SELECT role_name, role_level FROM ${TABLES.ROLES} WHERE ROWID = '${membership.role_id}'`
                    );
                    if (roleResult.length > 0) {
                        const role = roleResult[0].Roles || roleResult[0];
                        roleName = role.role_name || 'Staff';
                        roleLevel = parseInt(role.role_level) || 0;
                    }
                } catch (roleErr) {
                    console.warn('[WorkspacesService] Error fetching role:', roleErr.message);
                }
            }

            workspaces.push({
                workspace_id: ws.ROWID,
                workspace_name: ws.workspace_name,
                workspace_slug: ws.workspace_slug,
                brand_color: ws.brand_color,
                logo_url: ws.logo_url,
                status: ws.status,
                role_name: roleName,
                role_level: roleLevel,
                role_id: membership.role_id,
            });
        } catch (wsErr) {
            console.warn(`[WorkspacesService] Error fetching workspace ${wsId}:`, wsErr.message);
        }
    }

    return workspaces;
};

const getById = async (req, wsId) => {
    const result = await executeZCQL(req, `SELECT * FROM ${TABLES.WORKSPACES} WHERE ROWID = '${wsId}'`);
    return result.length > 0 ? result[0].Workspaces : null;
};

const getBySlug = async (req, slug) => {
    const result = await executeZCQL(req,
        `SELECT workspace_name, workspace_slug, brand_color, logo_url, status FROM ${TABLES.WORKSPACES} WHERE workspace_slug = '${slug}'`
    );
    return result.length > 0 ? result[0].Workspaces : null;
};

module.exports = { getMyWorkspaces, getById, getBySlug };
