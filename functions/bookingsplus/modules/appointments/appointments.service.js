/**
 * Appointments Service — Business logic for appointment CRUD operations.
 * IMPORTANT: All _id columns are BIGINT in Catalyst Data Store.
 * String-valued IDs like 'default' or '' will cause insert failures.
 */
const { getDatastore, executeWorkspaceScopedZCQL, insertAuditLog, catalystDateTime } = require('../../utils/datastore');
const { TABLES, AUDIT_ACTIONS, APPOINTMENT_STATUS, PAYMENT_STATUS, APPROVAL_STATUS } = require('../../core/constants');
const { NotFoundError } = require('../../core/errors');

/** Coerce any value to a safe BIGINT-compatible number, or 0 if not available */
const toBigIntOrZero = (value) => {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number' && !isNaN(value)) return value;
    const parsed = parseInt(String(value), 10);
    return (!isNaN(parsed) && parsed >= 0) ? parsed : 0;
};

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
    const { service_id, service_name, staff_id, staff_name, customer_id, customer_name, customer_email, start_time, end_time, notes } = data;

    const appointment_id = Date.now();
    const datastore = getDatastore(req);

    /**
     * Format a datetime value for Catalyst.
     * Catalyst datetime columns expect "yyyy-MM-dd HH:mm:ss" format.
     * Accepts ISO strings, Date objects, or "yyyy-MM-dd HH:mm:ss" strings.
     * Returns catalystDateTime(now) as a fallback if input is empty/invalid.
     */
    const formatDT = (val) => {
        if (!val) return catalystDateTime();
        // If already in "yyyy-MM-dd HH:mm:ss" format, pass through
        if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/.test(val)) return val;
        // Try to parse as a date
        const d = new Date(val);
        if (!isNaN(d.getTime())) return catalystDateTime(d);
        // Last resort — return current time
        return catalystDateTime();
    };

    // All _id columns are BIGINT — coerce to numbers, use 0 for unset
    // start_time/end_time are DATETIME — must be "yyyy-MM-dd HH:mm:ss"
    const recordData = {
        appointment_id,
        workspace_id: toBigIntOrZero(req.workspaceId),
        service_id: toBigIntOrZero(service_id),
        service_name: service_name || '',
        staff_id: toBigIntOrZero(staff_id),
        staff_name: staff_name || '',
        customer_id: toBigIntOrZero(customer_id),
        customer_name: customer_name || '',
        customer_email: customer_email || '',
        appointment_status: APPOINTMENT_STATUS.PENDING,
        start_time: formatDT(start_time),
        end_time: formatDT(end_time),
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
