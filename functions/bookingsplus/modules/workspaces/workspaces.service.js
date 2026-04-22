/**
 * Workspaces Service — Business logic for workspace management.
 */
const { executeZCQL } = require('../../utils/datastore');
const { TABLES } = require('../../core/constants');

const getMyWorkspaces = async (req) => {
    const userId = req.user.user_id || req.user.ROWID;

    // Super admins see all
    if (req.user.is_super_admin) {
        const allWs = await executeZCQL(req, `SELECT * FROM ${TABLES.WORKSPACES} WHERE status = 'active'`);
        return allWs.map(row => {
            const ws = row.Workspaces;
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
    }

    // Regular users see memberships
    const result = await executeZCQL(req,
        `SELECT uw.workspace_id, uw.role_id, uw.status as uw_status, 
                w.workspace_name, w.workspace_slug, w.brand_color, w.logo_url, w.status as ws_status,
                r.role_name, r.role_level
         FROM ${TABLES.USER_WORKSPACES} uw
         LEFT JOIN ${TABLES.WORKSPACES} w ON uw.workspace_id = w.ROWID
         LEFT JOIN ${TABLES.ROLES} r ON uw.role_id = r.ROWID
         WHERE uw.user_id = '${userId}' AND uw.status = 'active'`
    );

    return result.map(row => ({
        workspace_id: (row.UserWorkspaces || row).workspace_id,
        workspace_name: (row.Workspaces || row).workspace_name,
        workspace_slug: (row.Workspaces || row).workspace_slug,
        brand_color: (row.Workspaces || row).brand_color,
        logo_url: (row.Workspaces || row).logo_url,
        status: (row.Workspaces || row).ws_status || (row.Workspaces || row).status,
        role_name: (row.Roles || row).role_name || 'Staff',
        role_level: parseInt((row.Roles || row).role_level) || 0,
        role_id: (row.UserWorkspaces || row).role_id,
    })).filter(ws => ws.status === 'active');
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
