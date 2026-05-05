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
 * ═══════════════════════════════════════════════════════════════
 * CENTRALIZED organization_id resolver.
 * ═══════════════════════════════════════════════════════════════
 * 
 * In the Catalyst Data Store, `organization_id` is a MANDATORY BIGINT column
 * on ALL major tables (Organization, Users, Services, Appointments, Customers,
 * ServiceStaff, Workspaces, etc.). Every insertRow() call MUST include a valid
 * numeric `organization_id` or the SDK throws:
 *   "Column organization_id is mandatory and cannot be empty"
 * 
 * This helper resolves organization_id from multiple sources:
 *   1. req.organizationId (set by auth middleware — fastest, no DB call)
 *   2. Organization table ROWID (single DB call — cached in-memory)
 *   3. Fallback: Date.now() (guarantees a valid BIGINT — should never happen
 *      in a properly set-up deployment, but prevents crashes)
 * 
 * Results are cached on `req._resolvedOrgId` so repeated calls in the same
 * request don't hit the DB again.
 */
let _cachedOrgId = null;
let _cachedOrgIdAt = 0;

const resolveOrganizationId = async (req) => {
    // 1. Already resolved for this request
    if (req._resolvedOrgId) return req._resolvedOrgId;

    // 2. Set by auth middleware (most common case)
    if (req.organizationId) {
        const orgId = toBigIntSafe(req.organizationId);
        if (orgId > 0) {
            req._resolvedOrgId = orgId;
            return orgId;
        }
    }

    // 3. In-memory cache (valid for 30 seconds)
    const now = Date.now();
    if (_cachedOrgId && (now - _cachedOrgIdAt) < 30000) {
        req._resolvedOrgId = _cachedOrgId;
        return _cachedOrgId;
    }

    // 4. Fetch from Organization table
    try {
        const zcql = req.catalystApp.zcql();
        const result = await zcql.executeZCQLQuery('SELECT ROWID FROM Organization LIMIT 1');
        if (result && result.length > 0) {
            const rowId = (result[0].Organization || result[0]).ROWID;
            if (rowId) {
                const orgId = toBigIntSafe(rowId);
                if (orgId > 0) {
                    _cachedOrgId = orgId;
                    _cachedOrgIdAt = now;
                    req._resolvedOrgId = orgId;
                    req.organizationId = String(orgId); // Cache on req for other modules
                    return orgId;
                }
            }
        }
    } catch (e) {
        console.warn('[datastore] resolveOrganizationId: Failed to fetch from Organization table:', e.message);
    }

    // 5. Last resort — use Date.now() as a valid BIGINT placeholder
    console.error('[datastore] WARNING: Could not resolve organization_id — using Date.now() fallback');
    const fallback = Date.now();
    req._resolvedOrgId = fallback;
    return fallback;
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
    catalystDateTime,
    resolveOrganizationId,
    toBigIntSafe,
};
