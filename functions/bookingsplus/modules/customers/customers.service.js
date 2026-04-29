/**
 * Customers Service — Business logic for customer management.
 * Customers are people who book appointments.
 * IMPORTANT: All _id columns in Catalyst Data Store are BIGINT.
 */
const { getDatastore, executeZCQL, executeWorkspaceScopedZCQL, insertAuditLog, catalystDateTime } = require('../../utils/datastore');
const { TABLES } = require('../../core/constants');
const { NotFoundError, ValidationError, ConflictError } = require('../../core/errors');

const toBigInt = (value) => {
    if (value === null || value === undefined) return Date.now();
    if (typeof value === 'number' && !isNaN(value)) return value;
    const parsed = parseInt(String(value), 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
    return Date.now();
};

/** Resolve organization_id from req or DB */
const getOrgId = async (req) => {
    if (req.organizationId) return toBigInt(req.organizationId);
    try {
        const result = await executeZCQL(req, 'SELECT ROWID FROM Organization LIMIT 1');
        if (result.length > 0) return toBigInt(result[0].Organization.ROWID);
    } catch (e) { /* ignore */ }
    return 0;
};

/**
 * Get all customers in a workspace.
 * Includes appointment count from the Appointments table.
 */
const getAll = async (req) => {
    const query = `SELECT * FROM ${TABLES.CUSTOMERS} WHERE workspace_id = '${req.workspaceId}'`;
    const result = await executeWorkspaceScopedZCQL(req, query);

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
    const query = `SELECT * FROM ${TABLES.CUSTOMERS} WHERE ROWID = '${customerId}' AND workspace_id = '${req.workspaceId}'`;
    const result = await executeWorkspaceScopedZCQL(req, query);
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
        const existing = await executeWorkspaceScopedZCQL(req,
            `SELECT ROWID FROM ${TABLES.CUSTOMERS} WHERE workspace_id = '${req.workspaceId}' AND customer_email = '${email}'`
        );
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
    const existing = await executeWorkspaceScopedZCQL(req,
        `SELECT ROWID FROM ${TABLES.CUSTOMERS} WHERE ROWID = '${customerId}' AND workspace_id = '${req.workspaceId}'`
    );
    if (!existing || existing.length === 0) {
        throw new NotFoundError('Customer', customerId);
    }

    const datastore = getDatastore(req);

    // Remap frontend field names to DB column names
    const dbData = { ROWID: existing[0].Customers.ROWID };
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
    const existing = await executeWorkspaceScopedZCQL(req,
        `SELECT ROWID FROM ${TABLES.CUSTOMERS} WHERE ROWID = '${customerId}' AND workspace_id = '${req.workspaceId}'`
    );
    if (!existing || existing.length === 0) {
        throw new NotFoundError('Customer', customerId);
    }

    const datastore = getDatastore(req);
    await datastore.table(TABLES.CUSTOMERS).deleteRow(existing[0].Customers.ROWID);

    await insertAuditLog(req, {
        workspaceId: req.workspaceId,
        userId: req.user.user_id,
        action: 'customer.deleted',
        resourceType: TABLES.CUSTOMERS,
        resourceId: customerId,
    });
};

module.exports = { getAll, getById, create, update, remove };
