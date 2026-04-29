/**
 * Services Service — Business logic for service CRUD operations.
 * IMPORTANT: All _id columns are BIGINT in Catalyst Data Store.
 * 
 * Service Types & Staff Assignment Rules:
 * ─────────────────────────────────────────
 * 1. one-on-one: Multiple staff can be assigned. ONE available staff handles the appointment for ONE customer.
 * 2. group:      Multiple staff can be assigned. ONE available staff handles the session for MULTIPLE customers (webinar/class).
 * 3. collective: Multiple staff assigned. ALL assigned staff must be available for the appointment to happen (board meetings, panels).
 * 4. resource:   No staff needed — booking physical assets (rooms, equipment).
 */
const { getDatastore, executeZCQL, executeWorkspaceScopedZCQL, insertAuditLog } = require('../../utils/datastore');
const { TABLES, AUDIT_ACTIONS, SERVICE_TYPES } = require('../../core/constants');
const { NotFoundError, ValidationError } = require('../../core/errors');

/** Coerce any value to a safe BIGINT-compatible number */
const toBigInt = (value) => {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number' && !isNaN(value)) return value;
    const parsed = parseInt(String(value), 10);
    return (!isNaN(parsed) && parsed >= 0) ? parsed : 0;
};

/**
 * Resolve the organization_id for the current request.
 * Uses req.organizationId (set by auth middleware) or falls back to DB lookup.
 */
const getOrgId = async (req) => {
    if (req.organizationId) return toBigInt(req.organizationId);
    try {
        const result = await executeZCQL(req, 'SELECT ROWID FROM Organization LIMIT 1');
        if (result.length > 0) return toBigInt(result[0].Organization.ROWID);
    } catch (e) { /* ignore */ }
    return 0;
};

/**
 * Get all services for the workspace, including assigned staff IDs from ServiceStaff table.
 */
const getAll = async (req) => {
    // 1. Fetch all services
    const svcQuery = `SELECT * FROM ${TABLES.SERVICES} WHERE workspace_id = '${req.workspaceId}'`;
    const svcResult = await executeWorkspaceScopedZCQL(req, svcQuery);

    const services = svcResult.map(row => {
        const svc = row.Services;
        return {
            id: svc.service_id || svc.ROWID,
            ...svc,
            name: svc.service_name,
        };
    });

    if (services.length === 0) return services;

    // 2. Fetch all staff assignments for this workspace from ServiceStaff
    let staffAssignments = [];
    try {
        const ssQuery = `SELECT * FROM ${TABLES.SERVICE_STAFF} WHERE workspace_id = '${req.workspaceId}'`;
        const ssResult = await executeWorkspaceScopedZCQL(req, ssQuery);
        staffAssignments = ssResult.map(row => {
            const ss = row.ServiceStaff;
            return {
                service_id: ss.service_id,
                staff_id: ss.staff_id,
                ROWID: ss.ROWID,
            };
        });
    } catch (err) {
        console.error('Error fetching ServiceStaff assignments:', err.message);
    }

    // 3. Group staff IDs by service_id
    const staffByService = {};
    for (const sa of staffAssignments) {
        const svcId = String(sa.service_id);
        if (!staffByService[svcId]) staffByService[svcId] = [];
        staffByService[svcId].push(sa.staff_id);
    }

    // 4. Attach assignedStaff array to each service
    for (const svc of services) {
        const svcId = String(svc.service_id || svc.id);
        svc.assignedStaff = staffByService[svcId] || [];
        svc.staffCount = svc.assignedStaff.length;
    }

    return services;
};

/**
 * Get a single service by ID with its assigned staff details.
 */
const getById = async (req, serviceId) => {
    const query = `SELECT * FROM ${TABLES.SERVICES} WHERE service_id = '${serviceId}' AND workspace_id = '${req.workspaceId}'`;
    const result = await executeWorkspaceScopedZCQL(req, query);
    if (!result || result.length === 0) {
        throw new NotFoundError('Service', serviceId);
    }

    const svc = result[0].Services;
    const service = {
        id: svc.service_id || svc.ROWID,
        ...svc,
        name: svc.service_name,
    };

    // Fetch assigned staff with user details
    // IMPORTANT: Catalyst ZCQL does NOT support table aliases in JOINs.
// Fetch assigned staff using SEPARATE queries (no JOINs — avoids "No relationship" errors)
    try {
        const ssQuery = `SELECT * FROM ${TABLES.SERVICE_STAFF} WHERE service_id = '${serviceId}' AND workspace_id = '${req.workspaceId}'`;
        const ssResult = await executeWorkspaceScopedZCQL(req, ssQuery);
        const staffList = [];
        for (const row of ssResult) {
            const ss = row.ServiceStaff || row;
            const staffId = ss.staff_id;
            let staffName = 'Unknown';
            let staffEmail = '';
            if (staffId) {
                try {
                    const { executeZCQL } = require('../../utils/datastore');
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
        service.assignedStaff = staffList;
        service.staffCount = staffList.length;
    } catch (err) {
        console.error('Error fetching staff for service:', err.message);
        service.assignedStaff = [];
        service.staffCount = 0;
    }

    return service;
};

/**
 * Create a new service with mandatory staff assignment (except resource type).
 * 
 * Validation rules:
 * - service_type = 'resource': staff_ids NOT required (booking assets, not people)
 * - service_type = 'one-on-one' | 'group' | 'collective': staff_ids IS required (at least 1)
 */
const create = async (req, data) => {
    const { name, service_name, description, duration_minutes, duration, price, service_type, type, meeting_mode, meeting_location, seats, staff_ids } = data;
    const svcName = service_name || name;
    const svcType = service_type || type || 'one-on-one';

    if (!svcName) throw new ValidationError('Service name is required.');

    // Validate staff assignment based on service type
    const isResourceType = svcType === SERVICE_TYPES.RESOURCE;
    if (!isResourceType) {
        if (!Array.isArray(staff_ids) || staff_ids.length === 0) {
            throw new ValidationError(
                'At least one employee must be assigned to this service. Please add employees first, then create the service.'
            );
        }
    }

    const service_id = Date.now(); // BIGINT — must be numeric
    const datastore = getDatastore(req);

    const orgId = await getOrgId(req);

    const recordData = {
        service_id,
        organization_id: orgId,
        workspace_id: toBigInt(req.workspaceId),
        service_name: svcName,
        description: description || '',
        duration_minutes: parseInt(duration_minutes || duration, 10) || 60,
        price: String(parseFloat(price) || 0),
        service_type: svcType,
        meeting_mode: meeting_mode || 'Online',
        meeting_location: meeting_location || '',
        seats: parseInt(seats, 10) || 1,
        status: 'active',
    };

    const row = await datastore.table(TABLES.SERVICES).insertRow(recordData);

    // Assign staff — all _id columns are BIGINT
    const assignedStaffIds = [];
    if (Array.isArray(staff_ids) && staff_ids.length > 0) {
        const staffTable = datastore.table(TABLES.SERVICE_STAFF);
        for (const staffId of staff_ids) {
            try {
                await staffTable.insertRow({
                    service_id,
                    staff_id: toBigInt(staffId),
                    organization_id: orgId,
                    workspace_id: toBigInt(req.workspaceId),
                });
                assignedStaffIds.push(staffId);
            } catch (err) {
                console.error(`Failed to assign staff ${staffId} to service ${service_id}:`, err.message);
            }
        }
    }

    await insertAuditLog(req, {
        workspaceId: req.workspaceId,
        userId: req.user.user_id,
        action: AUDIT_ACTIONS.SVC_CREATED,
        resourceType: TABLES.SERVICES,
        resourceId: row.ROWID,
        details: { name: svcName, service_type: svcType, assigned_staff_count: assignedStaffIds.length },
    });

    // Return the service with assignedStaff info
    return {
        ...row,
        service_id,
        name: svcName,
        assignedStaff: assignedStaffIds,
        staffCount: assignedStaffIds.length,
    };
};

/**
 * Update a service's details.
 * NOTE: Use assignStaff/unassignStaff for staff changes.
 */
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

    // Don't allow overwriting these via generic update
    delete updateData.workspace_id;
    delete updateData.assignedStaff;
    delete updateData.staff_ids;
    delete updateData.staffCount;

    const datastore = getDatastore(req);
    const data = { ROWID: existing[0].Services.ROWID, ...updateData };
    return await datastore.table(TABLES.SERVICES).updateRow(data);
};

/**
 * Assign staff members to a service.
 * Accepts an array of user ROWID values.
 * Skips duplicates (staff already assigned).
 */
const assignStaff = async (req, serviceId, staffIds) => {
    if (!Array.isArray(staffIds) || staffIds.length === 0) {
        throw new ValidationError('At least one staff ID is required.');
    }

    // Verify service exists
    const svcQuery = `SELECT ROWID, service_type FROM ${TABLES.SERVICES} WHERE service_id = '${serviceId}' AND workspace_id = '${req.workspaceId}'`;
    const svcResult = await executeWorkspaceScopedZCQL(req, svcQuery);
    if (!svcResult || svcResult.length === 0) {
        throw new NotFoundError('Service', serviceId);
    }

    // Get existing assignments to prevent duplicates
    const existingQuery = `SELECT staff_id FROM ${TABLES.SERVICE_STAFF} WHERE service_id = '${serviceId}' AND workspace_id = '${req.workspaceId}'`;
    const existingResult = await executeWorkspaceScopedZCQL(req, existingQuery);
    const existingStaffIds = new Set(existingResult.map(r => String(r.ServiceStaff.staff_id)));

    const datastore = getDatastore(req);
    const staffTable = datastore.table(TABLES.SERVICE_STAFF);
    const orgId = await getOrgId(req);
    const added = [];

    for (const staffId of staffIds) {
        if (existingStaffIds.has(String(toBigInt(staffId)))) {
            continue; // Skip — already assigned
        }
        try {
            await staffTable.insertRow({
                service_id: toBigInt(serviceId),
                staff_id: toBigInt(staffId),
                organization_id: orgId,
                workspace_id: toBigInt(req.workspaceId),
            });
            added.push(staffId);
        } catch (err) {
            console.error(`Failed to assign staff ${staffId} to service ${serviceId}:`, err.message);
        }
    }

    await insertAuditLog(req, {
        workspaceId: req.workspaceId,
        userId: req.user.user_id,
        action: AUDIT_ACTIONS.SVC_UPDATED,
        resourceType: TABLES.SERVICE_STAFF,
        resourceId: serviceId,
        details: { action: 'assign_staff', added_staff_ids: added },
    });

    return { service_id: serviceId, added_count: added.length, added_staff_ids: added };
};

/**
 * Unassign staff members from a service.
 * For non-resource services, validates that at least 1 staff remains assigned.
 */
const unassignStaff = async (req, serviceId, staffIds) => {
    if (!Array.isArray(staffIds) || staffIds.length === 0) {
        throw new ValidationError('At least one staff ID is required.');
    }

    // Verify service exists and get its type
    const svcQuery = `SELECT service_type FROM ${TABLES.SERVICES} WHERE service_id = '${serviceId}' AND workspace_id = '${req.workspaceId}'`;
    const svcResult = await executeWorkspaceScopedZCQL(req, svcQuery);
    if (!svcResult || svcResult.length === 0) {
        throw new NotFoundError('Service', serviceId);
    }

    const svcType = svcResult[0].Services.service_type;
    const isResource = svcType === SERVICE_TYPES.RESOURCE;

    // Get all current assignments
    const existingQuery = `SELECT ROWID, staff_id FROM ${TABLES.SERVICE_STAFF} WHERE service_id = '${serviceId}' AND workspace_id = '${req.workspaceId}'`;
    const existingResult = await executeWorkspaceScopedZCQL(req, existingQuery);

    const staffIdsToRemove = new Set(staffIds.map(id => String(toBigInt(id))));
    const toDelete = existingResult.filter(r => staffIdsToRemove.has(String(r.ServiceStaff.staff_id)));
    const remaining = existingResult.length - toDelete.length;

    // Validate: non-resource services must keep at least 1 staff
    if (!isResource && remaining < 1) {
        throw new ValidationError(
            'Cannot remove all staff from this service. At least one employee must remain assigned. ' +
            'To remove all staff, change the service type to "Resource" first or delete the service.'
        );
    }

    const datastore = getDatastore(req);
    const removed = [];
    for (const row of toDelete) {
        try {
            await datastore.table(TABLES.SERVICE_STAFF).deleteRow(row.ServiceStaff.ROWID);
            removed.push(row.ServiceStaff.staff_id);
        } catch (err) {
            console.error(`Failed to unassign staff ${row.ServiceStaff.staff_id} from service ${serviceId}:`, err.message);
        }
    }

    await insertAuditLog(req, {
        workspaceId: req.workspaceId,
        userId: req.user.user_id,
        action: AUDIT_ACTIONS.SVC_UPDATED,
        resourceType: TABLES.SERVICE_STAFF,
        resourceId: serviceId,
        details: { action: 'unassign_staff', removed_staff_ids: removed },
    });

    return { service_id: serviceId, removed_count: removed.length, remaining_count: remaining };
};

/**
 * Replace all staff assignments for a service (bulk update).
 * Removes all current assignments and sets new ones.
 * For non-resource services, requires at least 1 staff in the new list.
 */
const replaceStaff = async (req, serviceId, staffIds) => {
    // Verify service exists and get its type
    const svcQuery = `SELECT service_type FROM ${TABLES.SERVICES} WHERE service_id = '${serviceId}' AND workspace_id = '${req.workspaceId}'`;
    const svcResult = await executeWorkspaceScopedZCQL(req, svcQuery);
    if (!svcResult || svcResult.length === 0) {
        throw new NotFoundError('Service', serviceId);
    }

    const svcType = svcResult[0].Services.service_type;
    const isResource = svcType === SERVICE_TYPES.RESOURCE;

    if (!isResource && (!Array.isArray(staffIds) || staffIds.length === 0)) {
        throw new ValidationError('At least one employee must be assigned to this service.');
    }

    // Delete all existing assignments
    const existingQuery = `SELECT ROWID FROM ${TABLES.SERVICE_STAFF} WHERE service_id = '${serviceId}' AND workspace_id = '${req.workspaceId}'`;
    const existingResult = await executeWorkspaceScopedZCQL(req, existingQuery);

    const datastore = getDatastore(req);
    for (const row of existingResult) {
        try {
            await datastore.table(TABLES.SERVICE_STAFF).deleteRow(row.ServiceStaff.ROWID);
        } catch (err) {
            console.error('Failed to remove old staff assignment:', err.message);
        }
    }

    // Insert new assignments
    const staffTable = datastore.table(TABLES.SERVICE_STAFF);
    const orgId = await getOrgId(req);
    const assigned = [];
    const safeStaffIds = Array.isArray(staffIds) ? staffIds : [];
    for (const staffId of safeStaffIds) {
        try {
            await staffTable.insertRow({
                service_id: toBigInt(serviceId),
                staff_id: toBigInt(staffId),
                organization_id: orgId,
                workspace_id: toBigInt(req.workspaceId),
            });
            assigned.push(staffId);
        } catch (err) {
            console.error(`Failed to assign staff ${staffId}:`, err.message);
        }
    }

    await insertAuditLog(req, {
        workspaceId: req.workspaceId,
        userId: req.user.user_id,
        action: AUDIT_ACTIONS.SVC_UPDATED,
        resourceType: TABLES.SERVICE_STAFF,
        resourceId: serviceId,
        details: { action: 'replace_staff', new_staff_ids: assigned },
    });

    return { service_id: serviceId, assigned_count: assigned.length, assigned_staff_ids: assigned };
};

/**
 * Get staff assigned to a specific service with user details.
 */
const getServiceStaff = async (req, serviceId) => {
    // Verify service exists
    const svcQuery = `SELECT ROWID FROM ${TABLES.SERVICES} WHERE service_id = '${serviceId}' AND workspace_id = '${req.workspaceId}'`;
    const svcResult = await executeWorkspaceScopedZCQL(req, svcQuery);
    if (!svcResult || svcResult.length === 0) {
        throw new NotFoundError('Service', serviceId);
    }

    // IMPORTANT: Catalyst ZCQL does NOT support table aliases in JOINs.
// Fetch staff assignments using SEPARATE queries (no JOINs — avoids "No relationship" errors)
    const ssQuery = `SELECT * FROM ${TABLES.SERVICE_STAFF} WHERE service_id = '${serviceId}' AND workspace_id = '${req.workspaceId}'`;
    const ssResult = await executeWorkspaceScopedZCQL(req, ssQuery);

    const staffList = [];
    for (const row of ssResult) {
        const ss = row.ServiceStaff || row;
        const staffId = ss.staff_id;
        let userInfo = {};
        if (staffId) {
            try {
                const { executeZCQL } = require('../../utils/datastore');
                const userResult = await executeZCQL(req,
                    `SELECT display_name, email, phone, designation, color, initials, status FROM ${TABLES.USERS} WHERE ROWID = '${staffId}'`
                );
                if (userResult.length > 0) {
                    userInfo = userResult[0].Users || userResult[0];
                }
            } catch (e) {
                // User lookup failed — use defaults
            }
        }
        staffList.push({
            staff_id: staffId,
            name: userInfo.display_name || 'Unknown',
            email: userInfo.email || '',
            phone: userInfo.phone || '',
            designation: userInfo.designation || '',
            color: userInfo.color || '#E0E7FF',
            initials: userInfo.initials || '',
            status: userInfo.status || 'active',
        });
    }

    return staffList;
};

const remove = async (req, serviceId) => {
    const query = `SELECT ROWID FROM ${TABLES.SERVICES} WHERE service_id = '${serviceId}' AND workspace_id = '${req.workspaceId}'`;
    const existing = await executeWorkspaceScopedZCQL(req, query);
    if (!existing || existing.length === 0) {
        throw new NotFoundError('Service', serviceId);
    }

    const datastore = getDatastore(req);

    // Also delete all ServiceStaff assignments for this service
    try {
        const ssQuery = `SELECT ROWID FROM ${TABLES.SERVICE_STAFF} WHERE service_id = '${serviceId}' AND workspace_id = '${req.workspaceId}'`;
        const ssResult = await executeWorkspaceScopedZCQL(req, ssQuery);
        for (const row of ssResult) {
            await datastore.table(TABLES.SERVICE_STAFF).deleteRow(row.ServiceStaff.ROWID);
        }
    } catch (err) {
        console.error('Error cleaning up ServiceStaff during service deletion:', err.message);
    }

    await datastore.table(TABLES.SERVICES).deleteRow(existing[0].Services.ROWID);

    await insertAuditLog(req, {
        workspaceId: req.workspaceId,
        userId: req.user.user_id,
        action: AUDIT_ACTIONS.SVC_DELETED,
        resourceType: TABLES.SERVICES,
        resourceId: serviceId,
    });
};

module.exports = { getAll, getById, create, update, remove, assignStaff, unassignStaff, replaceStaff, getServiceStaff };
