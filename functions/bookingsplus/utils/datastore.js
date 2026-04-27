// Helper wrapper to interact with Catalyst Datastore

/**
 * Catalyst Data Store datetime formatter.
 * Catalyst datetime columns do NOT accept ISO 8601 format (with T and Z).
 * They expect: "yyyy-MM-dd HH:mm:ss" (e.g., "2025-01-15 14:30:00").
 * 
 * @param {Date} [date] - Date to format (defaults to now)
 * @returns {string} Catalyst-compatible datetime string
 */
const catalystDateTime = (date) => {
    const d = date || new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

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

/** Coerce to numeric BIGINT or 0 */
const toBigIntSafe = (val) => {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number' && !isNaN(val)) return val;
    const p = parseInt(String(val), 10);
    return (!isNaN(p) && p >= 0) ? p : 0;
};

/**
 * Audit log helper — inserts an entry into AuditLog table.
 * workspace_id and user_id are BIGINT — must be numeric.
 */
const insertAuditLog = async (req, { workspaceId, userId, action, resourceType, resourceId, details }) => {
    try {
        const config = require('./config');
        if (!config.enableAuditLog) return;

        const datastore = getDatastore(req);
        await datastore.table('AuditLog').insertRow({
            workspace_id: toBigIntSafe(workspaceId),
            user_id: toBigIntSafe(userId),
            action: action || '',
            resource_type: resourceType || '',
            resource_id: resourceId ? String(resourceId) : '',
            details_json: details ? JSON.stringify(details) : '{}',
            ip_address: req.ip || req.headers['x-forwarded-for'] || '',
            created_at: catalystDateTime()
        });
    } catch (err) {
        console.error('Failed to insert audit log:', err.message);
    }
};

module.exports = {
    getDatastore,
    executeZCQL,
    executeWorkspaceScopedZCQL,
    insertAuditLog,
    catalystDateTime
};
