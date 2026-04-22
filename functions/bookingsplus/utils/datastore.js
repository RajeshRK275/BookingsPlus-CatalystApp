// Helper wrapper to interact with Catalyst Datastore
const getDatastore = (req) => {
    return req.catalystApp.datastore();
};

const executeZCQL = async (req, query) => {
    const zcql = req.catalystApp.zcql();
    return await zcql.executeZCQLQuery(query);
};

/**
 * Workspace-scoped query safety helper.
 * Rejects queries on workspace-bound tables that lack workspace_id filter.
 * Use this for all workspace-scoped route handlers.
 */
const WORKSPACE_TABLES = [
    'Services', 'Staff', 'Availability', 'Customers',
    'Appointments', 'Appointment_Approvals', 'Integrations', 'ServiceStaff',
    'Roles', 'RolePermissions', 'WorkspaceSettings', 'UserWorkspaces'
];

const executeWorkspaceScopedZCQL = async (req, query) => {
    const mentionsWorkspaceTable = WORKSPACE_TABLES.some(t => query.includes(t));
    if (mentionsWorkspaceTable && !query.includes('workspace_id')) {
        throw new Error('SECURITY: Query on workspace-scoped table missing workspace_id filter. Use executeZCQL for unscoped queries.');
    }
    return await executeZCQL(req, query);
};

/**
 * Audit log helper — inserts an entry into AuditLog table.
 */
const insertAuditLog = async (req, { workspaceId, userId, action, resourceType, resourceId, details }) => {
    try {
        const config = require('./config');
        if (!config.enableAuditLog) return;

        const datastore = getDatastore(req);
        await datastore.table('AuditLog').insertRow({
            workspace_id: workspaceId || '',
            user_id: userId || '',
            action: action || '',
            resource_type: resourceType || '',
            resource_id: resourceId ? String(resourceId) : '',
            details_json: details ? JSON.stringify(details) : '{}',
            ip_address: req.ip || req.headers['x-forwarded-for'] || '',
            created_at: new Date().toISOString()
        });
    } catch (err) {
        console.error('Failed to insert audit log:', err.message);
    }
};

module.exports = {
    getDatastore,
    executeZCQL,
    executeWorkspaceScopedZCQL,
    insertAuditLog
};
