/**
 * Services Service — Business logic for service CRUD operations.
 * IMPORTANT: All _id columns are BIGINT in Catalyst Data Store.
 */
const { getDatastore, executeWorkspaceScopedZCQL, insertAuditLog } = require('../../utils/datastore');
const { TABLES, AUDIT_ACTIONS } = require('../../core/constants');
const { NotFoundError, ValidationError } = require('../../core/errors');

/** Coerce any value to a safe BIGINT-compatible number */
const toBigInt = (value) => {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number' && !isNaN(value)) return value;
    const parsed = parseInt(String(value), 10);
    return (!isNaN(parsed) && parsed >= 0) ? parsed : 0;
};

const getAll = async (req) => {
    const query = `SELECT * FROM ${TABLES.SERVICES} WHERE workspace_id = '${req.workspaceId}'`;
    const result = await executeWorkspaceScopedZCQL(req, query);
    return result.map(row => {
        const svc = row.Services;
        return { id: svc.service_id || svc.ROWID, ...svc, name: svc.service_name };
    });
};

const create = async (req, data) => {
    const { name, service_name, description, duration_minutes, duration, price, service_type, type, meeting_mode, meeting_location, seats, staff_ids } = data;
    const svcName = service_name || name;

    if (!svcName) throw new ValidationError('Service name is required.');

    const service_id = Date.now(); // BIGINT — must be numeric
    const datastore = getDatastore(req);

    const recordData = {
        service_id,
        workspace_id: toBigInt(req.workspaceId),
        service_name: svcName,
        description: description || '',
        duration_minutes: parseInt(duration_minutes || duration, 10) || 60,
        price: String(parseFloat(price) || 0),
        service_type: service_type || type || 'one-on-one',
        meeting_mode: meeting_mode || 'Online',
        meeting_location: meeting_location || '',
        seats: parseInt(seats, 10) || 1,
        status: 'active',
    };

    const row = await datastore.table(TABLES.SERVICES).insertRow(recordData);

    // Assign staff — all _id columns are BIGINT
    if (Array.isArray(staff_ids) && staff_ids.length > 0) {
        const staffTable = datastore.table(TABLES.SERVICE_STAFF);
        await Promise.all(staff_ids.map(staffId =>
            staffTable.insertRow({
                service_id,
                staff_id: toBigInt(staffId),
                workspace_id: toBigInt(req.workspaceId),
            })
        ));
    }

    await insertAuditLog(req, {
        workspaceId: req.workspaceId,
        userId: req.user.user_id,
        action: AUDIT_ACTIONS.SVC_CREATED,
        resourceType: TABLES.SERVICES,
        resourceId: row.ROWID,
        details: { name: svcName },
    });

    return row;
};

const update = async (req, serviceId, updateData) => {
    const query = `SELECT ROWID FROM ${TABLES.SERVICES} WHERE service_id = '${serviceId}' AND workspace_id = '${req.workspaceId}'`;
    const existing = await executeWorkspaceScopedZCQL(req, query);
    if (!existing || existing.length === 0) {
        throw new NotFoundError('Service', serviceId);
    }

    // Remap 'name' → 'service_name' for Catalyst compatibility
    if (updateData.name && !updateData.service_name) {
        updateData.service_name = updateData.name;
    }
    delete updateData.name;

    const datastore = getDatastore(req);
    const data = { ROWID: existing[0].Services.ROWID, ...updateData };
    delete data.workspace_id;
    return await datastore.table(TABLES.SERVICES).updateRow(data);
};

const remove = async (req, serviceId) => {
    const query = `SELECT ROWID FROM ${TABLES.SERVICES} WHERE service_id = '${serviceId}' AND workspace_id = '${req.workspaceId}'`;
    const existing = await executeWorkspaceScopedZCQL(req, query);
    if (!existing || existing.length === 0) {
        throw new NotFoundError('Service', serviceId);
    }

    const datastore = getDatastore(req);
    await datastore.table(TABLES.SERVICES).deleteRow(existing[0].Services.ROWID);

    await insertAuditLog(req, {
        workspaceId: req.workspaceId,
        userId: req.user.user_id,
        action: AUDIT_ACTIONS.SVC_DELETED,
        resourceType: TABLES.SERVICES,
        resourceId: serviceId,
    });
};

module.exports = { getAll, create, update, remove };
