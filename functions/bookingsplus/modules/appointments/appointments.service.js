/**
 * Appointments Service — Business logic for appointment CRUD operations.
 */
const { getDatastore, executeWorkspaceScopedZCQL, insertAuditLog } = require('../../utils/datastore');
const { TABLES, AUDIT_ACTIONS, APPOINTMENT_STATUS, PAYMENT_STATUS, APPROVAL_STATUS } = require('../../core/constants');
const { NotFoundError } = require('../../core/errors');

const getAll = async (req, filters = {}) => {
    let query = `SELECT * FROM ${TABLES.APPOINTMENTS} WHERE workspace_id = '${req.workspaceId}'`;
    if (filters.status) {
        query += ` AND appointment_status = '${filters.status}'`;
    }
    const result = await executeWorkspaceScopedZCQL(req, query);
    return result.map(row => {
        const apt = row.Appointments;
        return { id: apt.appointment_id || apt.ROWID, ...apt };
    });
};

const book = async (req, data) => {
    const { service_id, service_name, staff_id, staff_name, customer_id, customer_name, start_time, end_time, notes } = data;

    const appointment_id = Date.now().toString();
    const datastore = getDatastore(req);

    const recordData = {
        appointment_id,
        workspace_id: req.workspaceId,
        service_id: service_id || '',
        service_name: service_name || '',
        staff_id: staff_id || '',
        staff_name: staff_name || '',
        customer_id: customer_id || '',
        customer_name: customer_name || '',
        appointment_status: APPOINTMENT_STATUS.PENDING,
        start_time: start_time || '',
        end_time: end_time || '',
        notes: notes || '',
        payment_status: PAYMENT_STATUS.UNPAID,
        approval_status: APPROVAL_STATUS.AWAITING,
    };

    const row = await datastore.table(TABLES.APPOINTMENTS).insertRow(recordData);

    await insertAuditLog(req, {
        workspaceId: req.workspaceId,
        userId: req.user.user_id,
        action: AUDIT_ACTIONS.APT_CREATED,
        resourceType: TABLES.APPOINTMENTS,
        resourceId: row.ROWID,
        details: { service_name, customer_name },
    });

    return row;
};

const update = async (req, appointmentId, updateData) => {
    const query = `SELECT ROWID FROM ${TABLES.APPOINTMENTS} WHERE appointment_id = '${appointmentId}' AND workspace_id = '${req.workspaceId}'`;
    const existing = await executeWorkspaceScopedZCQL(req, query);
    if (!existing || existing.length === 0) {
        throw new NotFoundError('Appointment', appointmentId);
    }

    const datastore = getDatastore(req);
    const data = { ROWID: existing[0].Appointments.ROWID, ...updateData };
    delete data.workspace_id;
    return await datastore.table(TABLES.APPOINTMENTS).updateRow(data);
};

const remove = async (req, appointmentId) => {
    const query = `SELECT ROWID FROM ${TABLES.APPOINTMENTS} WHERE appointment_id = '${appointmentId}' AND workspace_id = '${req.workspaceId}'`;
    const existing = await executeWorkspaceScopedZCQL(req, query);
    if (!existing || existing.length === 0) {
        throw new NotFoundError('Appointment', appointmentId);
    }

    const datastore = getDatastore(req);
    await datastore.table(TABLES.APPOINTMENTS).deleteRow(existing[0].Appointments.ROWID);

    await insertAuditLog(req, {
        workspaceId: req.workspaceId,
        userId: req.user.user_id,
        action: AUDIT_ACTIONS.APT_DELETED,
        resourceType: TABLES.APPOINTMENTS,
        resourceId: appointmentId,
    });
};

module.exports = { getAll, book, update, remove };
