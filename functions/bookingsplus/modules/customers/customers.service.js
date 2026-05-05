/**
 * Customers Service — Business logic for customer management.
 * Customers are people who book appointments.
 * IMPORTANT: All _id columns in Catalyst Data Store are BIGINT.
 * 
 * Uses the same multi-strategy workspace query pattern as services/appointments
 * to handle the known workspace_id mismatch from onboarding.
 */
const { getDatastore, executeZCQL, executeWorkspaceScopedZCQL, insertAuditLog, catalystDateTime, resolveOrganizationId } = require('../../utils/datastore');
const { TABLES } = require('../../core/constants');
const { NotFoundError, ValidationError, ConflictError } = require('../../core/errors');

const toBigInt = (value) => {
    if (value === null || value === undefined) return Date.now();
    if (typeof value === 'number' && !isNaN(value)) return value;
    const parsed = parseInt(String(value), 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
    return Date.now();
};

/** Resolve organization_id — delegates to centralized resolver */
const getOrgId = async (req) => {
    return await resolveOrganizationId(req);
};

/**
 * Multi-strategy workspace query helper.
 * Same pattern used by services and appointments modules.
 * Strategies: exact → custom wsId → fuzzy ±10 → ultra-wide
 */
const queryByWorkspace = async (req, tableName, extraWhere = '') => {
    const wsId = req.workspaceId;

    // Strategy 1: Exact match on workspace ROWID
    try {
        const q = `SELECT * FROM ${tableName} WHERE workspace_id = '${wsId}'${extraWhere}`;
        const result = await executeWorkspaceScopedZCQL(req, q);
        if (result.length > 0) {
            console.log(`[CustomersService] Strategy 1 (exact): ${tableName} found ${result.length} rows`);
            return result;
        }
    } catch (e) {
        console.warn(`[CustomersService] Strategy 1 failed for ${tableName}:`, e.message);
    }

    // Strategy 2: Match on custom workspace_id from Workspaces table
    try {
        const wsLookup = await executeZCQL(req,
            `SELECT workspace_id FROM ${TABLES.WORKSPACES} WHERE ROWID = '${wsId}'`
        );
        if (wsLookup.length > 0) {
            const customWsId = (wsLookup[0].Workspaces || wsLookup[0]).workspace_id;
            if (customWsId && String(customWsId) !== String(wsId)) {
                const q2 = `SELECT * FROM ${tableName} WHERE workspace_id = '${customWsId}'${extraWhere}`;
                const result2 = await executeZCQL(req, q2);
                if (result2.length > 0) {
                    console.log(`[CustomersService] Strategy 2 (custom wsId): ${tableName} found ${result2.length} rows`);
                    return result2;
                }
            }
        }
    } catch (e) {
        console.warn(`[CustomersService] Strategy 2 failed:`, e.message);
    }

    // Strategy 3: Fuzzy — fetch all and filter by workspace_id ±10
    try {
        const allQuery = `SELECT * FROM ${tableName} WHERE workspace_id IS NOT NULL${extraWhere}`;
        const allResult = await executeZCQL(req, allQuery);
        const targetWsId = parseInt(String(wsId), 10);
        if (!isNaN(targetWsId) && allResult.length > 0) {
            const fuzzy = allResult.filter(row => {
                const data = row[tableName] || row;
                const rowWsId = parseInt(String(data.workspace_id), 10);
                return !isNaN(rowWsId) && Math.abs(rowWsId - targetWsId) <= 10;
            });
            if (fuzzy.length > 0) {
                console.log(`[CustomersService] Strategy 3 (fuzzy ±10): ${tableName} matched ${fuzzy.length} rows`);
                return fuzzy;
            }
        }
    } catch (e) {
        console.warn(`[CustomersService] Strategy 3 failed:`, e.message);
    }

    // Strategy 4: Ultra-wide (no workspace filter, use only extraWhere)
    if (extraWhere) {
        try {
            const whereClause = extraWhere.trim().replace(/^AND\s+/i, '');
            const ultraQuery = `SELECT * FROM ${tableName} WHERE ${whereClause}`;
            const ultraResult = await executeZCQL(req, ultraQuery);
            if (ultraResult.length > 0) {
                console.log(`[CustomersService] Strategy 4 (ultra-wide): ${tableName} found ${ultraResult.length} rows`);
                return ultraResult;
            }
        } catch (e) {
            console.warn(`[CustomersService] Strategy 4 failed:`, e.message);
        }
    }

    return [];
};

/**
 * Get all customers in a workspace.
 */
const getAll = async (req) => {
    const result = await queryByWorkspace(req, TABLES.CUSTOMERS);

    return result.map(row => {
        const c = row.Customers || row;
        return {
            id: c.ROWID,
            customer_id: c.customer_id || c.ROWID,
            name: c.customer_name || c.name || '',
            email: c.customer_email || c.email || '',
            phone: c.customer_phone || c.phone || '',
            notes: c.notes || '',
            status: c.status || 'active',
            created_at: c.CREATEDTIME || c.created_at || '',
        };
    });
};

/**
 * Get a single customer by ID.
 */
const getById = async (req, customerId) => {
    const result = await queryByWorkspace(req, TABLES.CUSTOMERS, ` AND ROWID = '${customerId}'`);
    if (!result || result.length === 0) {
        throw new NotFoundError('Customer', customerId);
    }
    const c = result[0].Customers || result[0];
    return {
        id: c.ROWID,
        customer_id: c.customer_id || c.ROWID,
        name: c.customer_name || c.name || '',
        email: c.customer_email || c.email || '',
        phone: c.customer_phone || c.phone || '',
        notes: c.notes || '',
        status: c.status || 'active',
        created_at: c.CREATEDTIME || c.created_at || '',
    };
};

/**
 * Create a new customer in the workspace.
 */
const create = async (req, data) => {
    const { name, email, phone, notes } = data;

    if (!name && !email) {
        throw new ValidationError('Customer name or email is required.');
    }

    // Check for duplicate email in this workspace
    if (email) {
        const existing = await queryByWorkspace(req, TABLES.CUSTOMERS, ` AND customer_email = '${email}'`);
        if (existing.length > 0) {
            throw new ConflictError('A customer with this email already exists in this workspace.');
        }
    }

    const datastore = getDatastore(req);
    const customerName = name || email.split('@')[0];
    const orgId = await getOrgId(req);

    const row = await datastore.table(TABLES.CUSTOMERS).insertRow({
        customer_id: Date.now(),
        organization_id: orgId,
        workspace_id: toBigInt(req.workspaceId),
        customer_name: customerName,
        customer_email: email || '',
        customer_phone: phone || '',
        notes: notes || '',
        status: 'active',
        created_at: catalystDateTime(),
    });

    await insertAuditLog(req, {
        workspaceId: req.workspaceId,
        userId: req.user.user_id,
        action: 'customer.created',
        resourceType: TABLES.CUSTOMERS,
        resourceId: row.ROWID,
        details: { name: customerName, email },
    });

    return {
        id: row.ROWID,
        customer_id: row.customer_id,
        name: customerName,
        email: email || '',
        phone: phone || '',
        notes: notes || '',
        status: 'active',
    };
};

/**
 * Update a customer.
 */
const update = async (req, customerId, updateData) => {
    const existing = await queryByWorkspace(req, TABLES.CUSTOMERS, ` AND ROWID = '${customerId}'`);
    if (!existing || existing.length === 0) {
        throw new NotFoundError('Customer', customerId);
    }

    const datastore = getDatastore(req);
    const c = existing[0].Customers || existing[0];

    const dbData = { ROWID: c.ROWID };
    if (updateData.name !== undefined) dbData.customer_name = updateData.name;
    if (updateData.email !== undefined) dbData.customer_email = updateData.email;
    if (updateData.phone !== undefined) dbData.customer_phone = updateData.phone;
    if (updateData.notes !== undefined) dbData.notes = updateData.notes;
    if (updateData.status !== undefined) dbData.status = updateData.status;

    return await datastore.table(TABLES.CUSTOMERS).updateRow(dbData);
};

/**
 * Delete a customer.
 */
const remove = async (req, customerId) => {
    const existing = await queryByWorkspace(req, TABLES.CUSTOMERS, ` AND ROWID = '${customerId}'`);
    if (!existing || existing.length === 0) {
        throw new NotFoundError('Customer', customerId);
    }

    const datastore = getDatastore(req);
    const c = existing[0].Customers || existing[0];
    await datastore.table(TABLES.CUSTOMERS).deleteRow(c.ROWID);

    await insertAuditLog(req, {
        workspaceId: req.workspaceId,
        userId: req.user.user_id,
        action: 'customer.deleted',
        resourceType: TABLES.CUSTOMERS,
        resourceId: customerId,
    });
};

module.exports = { getAll, getById, create, update, remove };
