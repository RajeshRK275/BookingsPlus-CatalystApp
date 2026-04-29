/**
 * Appointments Service — Business logic for appointment CRUD operations.
 * IMPORTANT: All _id columns are BIGINT in Catalyst Data Store.
 * 
 * Booking Logic by Service Type:
 * ──────────────────────────────
 * 1. one-on-one: Auto-select ONE available staff from assigned pool → 1 customer per slot
 * 2. group:      Auto-select ONE available staff from assigned pool → MULTIPLE customers (up to seats limit)
 * 3. collective: ALL assigned staff must be free at the slot → 1 customer per slot (panel/board style)
 * 4. resource:   No staff needed — just book the time slot for the asset
 */
const { getDatastore, executeZCQL, executeWorkspaceScopedZCQL, insertAuditLog, catalystDateTime } = require('../../utils/datastore');
const { TABLES, AUDIT_ACTIONS, APPOINTMENT_STATUS, PAYMENT_STATUS, APPROVAL_STATUS, SERVICE_TYPES } = require('../../core/constants');
const { NotFoundError, ValidationError } = require('../../core/errors');

const toBigIntOrZero = (value) => {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number' && !isNaN(value)) return value;
    const parsed = parseInt(String(value), 10);
    return (!isNaN(parsed) && parsed >= 0) ? parsed : 0;
};

/** Resolve organization_id from req or DB */
const getOrgId = async (req) => {
    if (req.organizationId) return toBigIntOrZero(req.organizationId);
    try {
        const result = await executeZCQL(req, 'SELECT ROWID FROM Organization LIMIT 1');
        if (result.length > 0) return toBigIntOrZero(result[0].Organization.ROWID);
    } catch (e) { /* ignore */ }
    return 0;
};

/**
 * Format a datetime value for Catalyst.
 * Catalyst datetime columns expect "yyyy-MM-dd HH:mm:ss" format.
 */
const formatDT = (val) => {
    if (!val) return catalystDateTime();
    if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/.test(val)) return val;
    const d = new Date(val);
    if (!isNaN(d.getTime())) return catalystDateTime(d);
    return catalystDateTime();
};

/**
 * Get staff assigned to a service using SEPARATE queries (no JOINs).
 * Avoids "No relationship between tables" error in Catalyst ZCQL.
 */
const getAssignedStaffForService = async (req, serviceId) => {
    const { executeZCQL } = require('../../utils/datastore');

    // Step 1: Get ServiceStaff assignments
    const ssQuery = `SELECT * FROM ${TABLES.SERVICE_STAFF} WHERE service_id = '${serviceId}' AND workspace_id = '${req.workspaceId}'`;
    const ssResult = await executeWorkspaceScopedZCQL(req, ssQuery);

    // Step 2: For each assignment, fetch user details separately
    const staffList = [];
    for (const row of ssResult) {
        const ss = row.ServiceStaff || row;
        const staffId = ss.staff_id;
        let staffName = 'Unknown';
        let staffEmail = '';
        if (staffId) {
            try {
                const userResult = await executeZCQL(req,
                    `SELECT display_name, email FROM ${TABLES.USERS} WHERE ROWID = '${staffId}'`
                );
                if (userResult.length > 0) {
                    const u = userResult[0].Users || userResult[0];
                    staffName = u.display_name || 'Unknown';
                    staffEmail = u.email || '';
                }
            } catch (e) {
                // User lookup failed — use defaults
            }
        }
        staffList.push({
            staff_id: staffId,
            name: staffName,
            email: staffEmail,
        });
    }
    return staffList;
};
/**
 * Check which staff have conflicting appointments at the given time.
 * Returns a Set of staff_id values that are BUSY.
 */
const getBusyStaffIds = async (req, startTime, endTime) => {
    const formattedStart = formatDT(startTime);
    const formattedEnd = formatDT(endTime);
    const query = `SELECT staff_id FROM ${TABLES.APPOINTMENTS} 
                   WHERE workspace_id = '${req.workspaceId}' 
                   AND appointment_status != '${APPOINTMENT_STATUS.CANCELLED}' 
                   AND start_time < '${formattedEnd}' 
                   AND end_time > '${formattedStart}'`;
    const result = await executeWorkspaceScopedZCQL(req, query);
    return new Set(result.map(row => String(row.Appointments.staff_id)));
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

/**
 * Book an appointment with service-type-aware staff resolution.
 * 
 * @param {object} data
 * @param {string} data.service_id     — REQUIRED: which service to book
 * @param {string} data.start_time     — REQUIRED: appointment start
 * @param {string} data.end_time       — REQUIRED: appointment end
 * @param {string} data.customer_name  — customer name
 * @param {string} data.customer_email — customer email
 * @param {string} [data.staff_id]     — OPTIONAL: explicitly chosen staff (for admin manual booking)
 * @param {string} [data.staff_name]   — staff display name (optional override)
 * @param {string} [data.notes]        — booking notes
 */
const book = async (req, data) => {
    const {
        service_id, service_name: providedServiceName,
        staff_id: requestedStaffId, staff_name: providedStaffName,
        customer_id, customer_name, customer_email,
        start_time, end_time, notes,
    } = data;

    if (!service_id) throw new ValidationError('Service ID is required for booking.');
    if (!start_time || !end_time) throw new ValidationError('Start time and end time are required.');

    // 1. Fetch the service to get type and name
    let serviceType = 'one-on-one';
    let serviceName = providedServiceName || '';
    try {
        const svcQuery = `SELECT service_name, service_type, seats FROM ${TABLES.SERVICES} WHERE service_id = '${service_id}' AND workspace_id = '${req.workspaceId}'`;
        const svcResult = await executeWorkspaceScopedZCQL(req, svcQuery);
        if (svcResult.length > 0) {
            const svc = svcResult[0].Services;
            serviceType = svc.service_type || 'one-on-one';
            serviceName = serviceName || svc.service_name || '';
        }
    } catch (err) {
        console.error('Error fetching service for booking:', err.message);
    }

    let resolvedStaffId = 0;
    let resolvedStaffName = providedStaffName || '';

    // 2. Resolve staff based on service type
    if (serviceType === SERVICE_TYPES.RESOURCE) {
        // ─── RESOURCE: No staff needed ───
        resolvedStaffId = 0;
        resolvedStaffName = 'N/A (Resource)';

    } else if (serviceType === SERVICE_TYPES.COLLECTIVE) {
        // ─── COLLECTIVE: ALL assigned staff must be available ───
        const assignedStaff = await getAssignedStaffForService(req, service_id);
        if (assignedStaff.length === 0) {
            throw new ValidationError('No staff assigned to this service. Cannot create a collective booking.');
        }

        const busyStaffIds = await getBusyStaffIds(req, start_time, end_time);
        const unavailableStaff = assignedStaff.filter(s => busyStaffIds.has(String(s.staff_id)));

        if (unavailableStaff.length > 0) {
            const unavailableNames = unavailableStaff.map(s => s.name).join(', ');
            throw new ValidationError(
                `Collective booking requires ALL assigned staff to be available. ` +
                `The following staff have conflicts: ${unavailableNames}. ` +
                `Please choose a different time slot.`
            );
        }

        // For collective, store the first staff member as primary; all are implicitly involved
        resolvedStaffId = toBigIntOrZero(assignedStaff[0].staff_id);
        resolvedStaffName = assignedStaff.map(s => s.name).join(', ');

    } else {
        // ─── ONE-ON-ONE / GROUP: Auto-select ONE available staff from assigned pool ───

        // If admin explicitly chose a staff, validate they're assigned to this service
        if (requestedStaffId && requestedStaffId !== 'default' && toBigIntOrZero(requestedStaffId) > 0) {
            resolvedStaffId = toBigIntOrZero(requestedStaffId);
            resolvedStaffName = providedStaffName || '';
        } else {
            // Auto-assign: pick first available staff from the assigned pool
            const assignedStaff = await getAssignedStaffForService(req, service_id);
            if (assignedStaff.length === 0) {
                throw new ValidationError('No staff assigned to this service. Please assign staff before booking.');
            }

            const busyStaffIds = await getBusyStaffIds(req, start_time, end_time);
            const availableStaff = assignedStaff.filter(s => !busyStaffIds.has(String(s.staff_id)));

            if (availableStaff.length === 0) {
                throw new ValidationError(
                    'No staff are available for this time slot. All assigned staff have conflicting appointments. ' +
                    'Please choose a different time.'
                );
            }

            // Pick the first available (round-robin can be added later)
            resolvedStaffId = toBigIntOrZero(availableStaff[0].staff_id);
            resolvedStaffName = availableStaff[0].name;
        }
    }

    // 3. Create the appointment record
    const appointment_id = Date.now();
    const datastore = getDatastore(req);
    const orgId = await getOrgId(req);

    const recordData = {
        appointment_id,
        organization_id: orgId,
        workspace_id: toBigIntOrZero(req.workspaceId),
        service_id: toBigIntOrZero(service_id),
        service_name: serviceName,
        staff_id: resolvedStaffId,
        staff_name: resolvedStaffName,
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
        details: {
            service_name: serviceName,
            service_type: serviceType,
            customer_name,
            resolved_staff: resolvedStaffName,
        },
    });

    return {
        ...row,
        appointment_id,
        service_type: serviceType,
        resolved_staff_name: resolvedStaffName,
    };
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
