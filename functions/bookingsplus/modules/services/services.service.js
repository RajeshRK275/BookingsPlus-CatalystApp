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
 *
 * IMPORTANT — organization_id column:
 * ───────────────────────────────────
 * The Services table in the ACTUAL Catalyst Data Store console has an `organization_id`
 * column that is configured as MANDATORY (required). Even though the local database_schema.sql
 * did not originally list it, the column DOES exist and MUST be populated on every insert.
 * The value comes from req.organizationId (set by auth middleware from Organization.ROWID).
 *
 * The ServiceStaff table may also have organization_id as mandatory — we include it
 * defensively on all inserts to both tables.
 */
const { getDatastore, executeZCQL, executeWorkspaceScopedZCQL, insertAuditLog, resolveOrganizationId: centralResolveOrgId } = require('../../utils/datastore');
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
 * Multi-strategy workspace query helper.
 * Handles the known onboarding ID mismatch where workspace_id stored in rows
 * may not exactly match req.workspaceId (the Workspaces ROWID).
 *
 * Strategies:
 *   1. Exact match on req.workspaceId (ideal — works for all newly created data)
 *   2. Match on Workspaces.workspace_id custom column (legacy onboarding data)
 *   3. Fuzzy: fetch all rows and filter where workspace_id is within ±10 of target
 *
 * @param {object} req - Express request with req.workspaceId
 * @param {string} tableName - Catalyst table name (e.g., 'Services', 'ServiceStaff')
 * @param {string} [extraWhere] - Additional WHERE conditions (e.g., " AND service_id = '123'")
 * @returns {Promise<Array>} - Array of raw ZCQL result rows (e.g., [{ Services: {...} }])
 */
const queryByWorkspace = async (req, tableName, extraWhere = '') => {
    const wsId = req.workspaceId;

    // Strategy 1: Exact match on workspace ROWID (works for newly created data)
    try {
        const q = `SELECT * FROM ${tableName} WHERE workspace_id = '${wsId}'${extraWhere}`;
        const result = await executeWorkspaceScopedZCQL(req, q);
        if (result.length > 0) {
            console.log(`[ServicesService] Strategy 1 (exact): ${tableName} found ${result.length} rows for workspace_id=${wsId}`);
            return result;
        }
    } catch (e) {
        console.warn(`[ServicesService] Strategy 1 failed for ${tableName}:`, e.message);
    }

    // Strategy 2: Match on the custom workspace_id field from Workspaces table
    // (during onboarding, some tables stored the custom field value instead of ROWID)
    try {
        const wsLookup = await executeZCQL(req,
            `SELECT workspace_id FROM ${TABLES.WORKSPACES} WHERE ROWID = '${wsId}'`
        );
        if (wsLookup.length > 0) {
            const customWsId = (wsLookup[0].Workspaces || wsLookup[0]).workspace_id;
            if (customWsId && String(customWsId) !== String(wsId)) {
                console.log(`[ServicesService] Strategy 2: Trying custom workspace_id=${customWsId}`);
                const q2 = `SELECT * FROM ${tableName} WHERE workspace_id = '${customWsId}'${extraWhere}`;
                const result2 = await executeZCQL(req, q2);
                if (result2.length > 0) {
                    console.log(`[ServicesService] Strategy 2 (custom wsId): ${tableName} found ${result2.length} rows`);
                    return result2;
                }
            }
        }
    } catch (e) {
        console.warn(`[ServicesService] Strategy 2 failed for ${tableName}:`, e.message);
    }

    // Strategy 3: Fuzzy — fetch ALL rows and filter by workspace_id proximity (±10)
    try {
        console.log(`[ServicesService] Strategy 3: Fuzzy matching for ${tableName}...`);
        const allQuery = `SELECT * FROM ${tableName} WHERE workspace_id IS NOT NULL${extraWhere}`;
        const allResult = await executeZCQL(req, allQuery);
        const targetWsId = parseInt(String(wsId), 10);

        if (!isNaN(targetWsId) && allResult.length > 0) {
            const fuzzyMatched = allResult.filter(row => {
                const data = row[tableName] || row;
                const rowWsId = parseInt(String(data.workspace_id), 10);
                return !isNaN(rowWsId) && Math.abs(rowWsId - targetWsId) <= 10;
            });
            if (fuzzyMatched.length > 0) {
                console.log(`[ServicesService] Strategy 3 (fuzzy ±10): ${tableName} matched ${fuzzyMatched.length} rows`);
                return fuzzyMatched;
            }
        }
    } catch (e) {
        console.warn(`[ServicesService] Strategy 3 failed for ${tableName}:`, e.message);
    }

    // Strategy 4: Ultra-wide — ignore workspace_id entirely, use ONLY extraWhere
    // Last resort for single-workspace deployments where workspace_id mismatch
    // is too large for fuzzy ±10 (e.g., completely different IDs from migration).
    if (extraWhere) {
        try {
            console.log(`[ServicesService] Strategy 4: Ultra-wide for ${tableName} (ignoring workspace)...`);
            const whereClause = extraWhere.trim().replace(/^AND\s+/i, '');
            const ultraQuery = `SELECT * FROM ${tableName} WHERE ${whereClause}`;
            const ultraResult = await executeZCQL(req, ultraQuery);
            if (ultraResult.length > 0) {
                console.log(`[ServicesService] Strategy 4 (ultra-wide): ${tableName} found ${ultraResult.length} rows (no workspace filter)`);
                return ultraResult;
            }
        } catch (e) {
            console.warn(`[ServicesService] Strategy 4 failed for ${tableName}:`, e.message);
        }
    }

    console.log(`[ServicesService] All strategies exhausted for ${tableName}, workspace_id=${wsId} — returning empty`);
    return [];
};

/**
 * Get all services for the workspace, including assigned staff IDs from ServiceStaff table.
 */
const getAll = async (req) => {
    // 1. Fetch all services using multi-strategy workspace lookup
    const svcResult = await queryByWorkspace(req, TABLES.SERVICES);

    const services = svcResult.map(row => {
        const svc = row.Services || row;
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
        const ssResult = await queryByWorkspace(req, TABLES.SERVICE_STAFF);
        staffAssignments = ssResult.map(row => {
            const ss = row.ServiceStaff || row;
            return {
                service_id: ss.service_id,
                staff_id: ss.staff_id,
                ROWID: ss.ROWID,
            };
        });
        console.log(`[ServicesService] getAll: Found ${staffAssignments.length} total ServiceStaff rows`);
    } catch (err) {
        console.error('Error fetching ServiceStaff assignments:', err.message);
    }

    // 2b. Batch-fetch all users to resolve staff_id → user ROWID (for reliable frontend matching)
    const allUsers = await getAllUsersCached(req);

    // 3. Group staff IDs by service_id, resolving to user ROWIDs where possible
    const staffByService = {};
    for (const sa of staffAssignments) {
        const svcId = String(sa.service_id);
        if (!staffByService[svcId]) staffByService[svcId] = [];

        // Resolve the staff_id to the user's actual ROWID for reliable frontend matching.
        // The frontend employees have id = ROWID; if ServiceStaff.staff_id is a custom user_id,
        // the frontend can't match it. By resolving to ROWID here, the frontend gets clean IDs.
        const userInfo = findUserByStaffId(allUsers, sa.staff_id);
        const resolvedId = userInfo ? userInfo.ROWID : sa.staff_id;
        staffByService[svcId].push(resolvedId);
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
    const svcResult = await queryByWorkspace(req, TABLES.SERVICES, ` AND service_id = '${serviceId}'`);

    if (!svcResult || svcResult.length === 0) {
        throw new NotFoundError('Service', serviceId);
    }

    const svc = svcResult[0].Services || svcResult[0];
    const service = {
        id: svc.service_id || svc.ROWID,
        ...svc,
        name: svc.service_name,
    };

    // Fetch assigned staff with user details using batch lookup + fuzzy matching
    try {
        const ssResult = await queryByWorkspace(req, TABLES.SERVICE_STAFF, ` AND service_id = '${serviceId}'`);
        const allUsers = await getAllUsersCached(req);

        const staffList = [];
        for (const row of ssResult) {
            const ss = row.ServiceStaff || row;
            const staffId = ss.staff_id;
            const userInfo = findUserByStaffId(allUsers, staffId);

            staffList.push({
                staff_id: staffId,
                name: userInfo?.display_name || 'Unknown',
                email: userInfo?.email || '',
                user_rowid: userInfo?.ROWID || staffId,
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
 * Resolve the organization_id for the current request.
 * Delegates to the centralized resolveOrganizationId() in datastore.js.
 * This ensures ALL modules resolve org ID consistently and benefit from caching.
 */
const resolveOrganizationId = async (req) => {
    return await centralResolveOrgId(req);
};

/**
 * Insert a row into the ServiceStaff table.
 * 
 * RESILIENT STRATEGY: The ServiceStaff table may or may not have `organization_id`.
 * We try multiple payload shapes until one succeeds:
 *   1. Full payload (with organization_id) — in case the column is mandatory
 *   2. Without organization_id — in case the column doesn't exist
 *   3. Minimal payload (service_id, staff_id, workspace_id) — absolute minimum
 * 
 * This prevents silent failures when assigning multiple staff members.
 */
const insertServiceStaffRow = async (staffTable, payload) => {
    const { service_id, staff_id, workspace_id, organization_id } = payload;

    // Attempt 1: Full payload with organization_id
    try {
        const fullPayload = { service_id, staff_id, workspace_id };
        if (organization_id) fullPayload.organization_id = organization_id;
        await staffTable.insertRow(fullPayload);
        return { success: true, strategy: 'full' };
    } catch (err1) {
        const msg1 = (err1.message || '').toLowerCase();
        console.warn(`[ServicesService] ServiceStaff insert attempt 1 failed for staff_id=${staff_id}: ${err1.message}`);

        // Attempt 2: Without organization_id (column might not exist)
        if (msg1.includes('invalid') || msg1.includes('column') || msg1.includes('organization')) {
            try {
                await staffTable.insertRow({ service_id, staff_id, workspace_id });
                return { success: true, strategy: 'no_org_id' };
            } catch (err2) {
                console.warn(`[ServicesService] ServiceStaff insert attempt 2 failed for staff_id=${staff_id}: ${err2.message}`);

                // Attempt 3: Minimal — just the 3 core fields, coerced fresh
                try {
                    await staffTable.insertRow({
                        service_id: toBigInt(service_id),
                        staff_id: toBigInt(staff_id),
                        workspace_id: toBigInt(workspace_id),
                    });
                    return { success: true, strategy: 'minimal' };
                } catch (err3) {
                    console.error(`[ServicesService] ServiceStaff insert ALL attempts failed for staff_id=${staff_id}: ${err3.message}`);
                    return { success: false, error: err3.message };
                }
            }
        }

        // Non-column error — try once more without org_id
        try {
            await staffTable.insertRow({ service_id, staff_id, workspace_id });
            return { success: true, strategy: 'retry_no_org' };
        } catch (err2) {
            console.error(`[ServicesService] ServiceStaff insert retry failed for staff_id=${staff_id}: ${err2.message}`);
            return { success: false, error: err2.message };
        }
    }
};

/**
 * Create a new service with mandatory staff assignment (except resource type).
 * 
 * Validation rules:
 * - service_type = 'resource': staff_ids NOT required (booking assets, not people)
 * - service_type = 'one-on-one' | 'group' | 'collective': staff_ids IS required (at least 1)
 *
 * IMPORTANT: The Services table has organization_id as a MANDATORY column in the
 * Catalyst Data Store console. It MUST be included in every insert or the SDK
 * will throw a "Column organization_id is mandatory and cannot be empty" error.
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

    // Resolve organization_id — MANDATORY column in Catalyst Data Store
    const orgId = await resolveOrganizationId(req);

    // Build insert payload — includes ALL mandatory columns in the actual Data Store:
    //   service_id, organization_id (MANDATORY), workspace_id, service_name,
    //   description, duration_minutes, price, service_type, meeting_mode,
    //   meeting_location, seats, status
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

    console.log(`[ServicesService] Creating service "${svcName}": org_id=${orgId}, workspace_id=${recordData.workspace_id}, service_id=${service_id}`);

    const row = await datastore.table(TABLES.SERVICES).insertRow(recordData);

    console.log(`[ServicesService] Service created: ROWID=${row.ROWID}, service_id=${service_id}`);

    // Assign staff to the service via ServiceStaff table.
    // Uses resilient insert helper that tries multiple payload shapes to handle
    // the organization_id column possibly existing or not existing.
    const assignedStaffIds = [];
    const failedStaffIds = [];
    if (Array.isArray(staff_ids) && staff_ids.length > 0) {
        const staffTable = datastore.table(TABLES.SERVICE_STAFF);
        console.log(`[ServicesService] Assigning ${staff_ids.length} staff to service ${service_id}: [${staff_ids.join(', ')}]`);

        for (const staffId of staff_ids) {
            const result = await insertServiceStaffRow(staffTable, {
                service_id,
                staff_id: toBigInt(staffId),
                workspace_id: toBigInt(req.workspaceId),
                organization_id: orgId,
            });
            if (result.success) {
                assignedStaffIds.push(staffId);
                console.log(`[ServicesService] ✓ Staff ${staffId} assigned (strategy: ${result.strategy})`);
            } else {
                failedStaffIds.push(staffId);
                console.error(`[ServicesService] ✗ Staff ${staffId} FAILED to assign: ${result.error}`);
            }
        }
    }

    console.log(`[ServicesService] Assigned ${assignedStaffIds.length}/${staff_ids?.length || 0} staff to service ${service_id}. Failed: [${failedStaffIds.join(', ')}]`);

    // Verification: re-query ServiceStaff to confirm how many rows were actually inserted
    try {
        const verifyResult = await executeZCQL(req,
            `SELECT * FROM ${TABLES.SERVICE_STAFF} WHERE service_id = '${service_id}'`
        );
        console.log(`[ServicesService] VERIFICATION: ServiceStaff has ${verifyResult.length} rows for service_id=${service_id}`);
        if (verifyResult.length < staff_ids?.length) {
            console.warn(`[ServicesService] WARNING: Expected ${staff_ids.length} ServiceStaff rows but only ${verifyResult.length} exist!`);
        }
    } catch (verifyErr) {
        console.warn(`[ServicesService] Verification query failed: ${verifyErr.message}`);
    }

    await insertAuditLog(req, {
        workspaceId: req.workspaceId,
        userId: req.user.user_id,
        action: AUDIT_ACTIONS.SVC_CREATED,
        resourceType: TABLES.SERVICES,
        resourceId: row.ROWID,
        details: { name: svcName, service_type: svcType, assigned_staff_count: assignedStaffIds.length, failed_staff: failedStaffIds },
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
 * Valid columns in the Services table that can be updated.
 * This whitelist prevents "Invalid column name" errors from Catalyst SDK
 * when the frontend sends extra fields (id, name, assignedStaff, etc.)
 * that don't exist as actual Data Store columns.
 */
const SERVICES_UPDATABLE_COLUMNS = new Set([
    'service_name', 'description', 'duration_minutes', 'price',
    'service_type', 'meeting_mode', 'meeting_location', 'seats', 'status',
]);

/**
 * Map frontend field names to actual Data Store column names.
 * The frontend uses camelCase and short names; the DB uses snake_case.
 */
const FRONTEND_TO_DB_FIELD_MAP = {
    name: 'service_name',
    service_name: 'service_name',
    duration: 'duration_minutes',
    duration_minutes: 'duration_minutes',
    meetingMode: 'meeting_mode',
    meeting_mode: 'meeting_mode',
    meetingLocation: 'meeting_location',
    meeting_location: 'meeting_location',
    service_type: 'service_type',
    type: 'service_type',
    description: 'description',
    price: 'price',
    seats: 'seats',
    status: 'status',
};

/**
 * Update a service's details.
 * NOTE: Use assignStaff/unassignStaff for staff changes.
 *
 * IMPORTANT: The frontend sends the entire service object (including computed
 * fields like `id`, `assignedStaff`, `staffCount`, `priceType`, `visibility`).
 * We MUST whitelist only valid Data Store columns, or Catalyst SDK throws
 * "Invalid column name <field>" errors.
 */
const update = async (req, serviceId, updateData) => {
    const existing = await queryByWorkspace(req, TABLES.SERVICES, ` AND service_id = '${serviceId}'`);
    if (!existing || existing.length === 0) {
        throw new NotFoundError('Service', serviceId);
    }

    // Build a clean payload with ONLY valid Data Store columns
    const cleanData = {};
    for (const [frontendKey, value] of Object.entries(updateData)) {
        const dbColumn = FRONTEND_TO_DB_FIELD_MAP[frontendKey];
        if (dbColumn && SERVICES_UPDATABLE_COLUMNS.has(dbColumn) && value !== undefined) {
            cleanData[dbColumn] = value;
        }
    }

    // Handle price: frontend may send priceType='Free'/'Paid' + priceValue
    if (updateData.priceType === 'Free') {
        cleanData.price = '0';
    } else if (updateData.priceType === 'Paid' && updateData.priceValue !== undefined) {
        cleanData.price = String(parseFloat(updateData.priceValue) || 0);
    }

    // Handle duration: frontend may send raw minutes or hours*60+mins
    if (cleanData.duration_minutes !== undefined) {
        cleanData.duration_minutes = parseInt(cleanData.duration_minutes, 10) || 60;
    }

    // Handle seats
    if (cleanData.seats !== undefined) {
        cleanData.seats = parseInt(cleanData.seats, 10) || 1;
    }

    if (Object.keys(cleanData).length === 0) {
        console.warn('[ServicesService] update: No valid fields to update after filtering. Raw payload keys:', Object.keys(updateData));
        throw new ValidationError('No valid fields provided for update.');
    }

    const datastore = getDatastore(req);
    const svcRow = existing[0].Services || existing[0];

    // ROWID is required by Catalyst SDK to identify the row to update
    const data = { ROWID: svcRow.ROWID, ...cleanData };

    console.log(`[ServicesService] Updating service ROWID=${svcRow.ROWID}, service_id=${serviceId}. Clean payload:`, JSON.stringify(cleanData));

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
    const svcResult = await queryByWorkspace(req, TABLES.SERVICES, ` AND service_id = '${serviceId}'`);
    if (!svcResult || svcResult.length === 0) {
        throw new NotFoundError('Service', serviceId);
    }

    // Get existing assignments to prevent duplicates
    const existingResult = await queryByWorkspace(req, TABLES.SERVICE_STAFF, ` AND service_id = '${serviceId}'`);
    const existingStaffIds = new Set(existingResult.map(r => {
        const ss = r.ServiceStaff || r;
        return String(ss.staff_id);
    }));

    const datastore = getDatastore(req);
    const staffTable = datastore.table(TABLES.SERVICE_STAFF);
    const orgId = await resolveOrganizationId(req);
    const added = [];

    for (const staffId of staffIds) {
        if (existingStaffIds.has(String(toBigInt(staffId)))) {
            continue; // Skip — already assigned
        }
        const result = await insertServiceStaffRow(staffTable, {
            service_id: toBigInt(serviceId),
            staff_id: toBigInt(staffId),
            workspace_id: toBigInt(req.workspaceId),
            organization_id: orgId,
        });
        if (result.success) {
            added.push(staffId);
        } else {
            console.error(`[ServicesService] Failed to assign staff ${staffId} to service ${serviceId}: ${result.error}`);
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
    const svcResult = await queryByWorkspace(req, TABLES.SERVICES, ` AND service_id = '${serviceId}'`);
    if (!svcResult || svcResult.length === 0) {
        throw new NotFoundError('Service', serviceId);
    }

    const svcData = svcResult[0].Services || svcResult[0];
    const svcType = svcData.service_type;
    const isResource = svcType === SERVICE_TYPES.RESOURCE;

    // Get all current assignments
    const existingResult = await queryByWorkspace(req, TABLES.SERVICE_STAFF, ` AND service_id = '${serviceId}'`);

    const staffIdsToRemove = new Set(staffIds.map(id => String(toBigInt(id))));
    const toDelete = existingResult.filter(r => {
        const ss = r.ServiceStaff || r;
        return staffIdsToRemove.has(String(ss.staff_id));
    });
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
        const ss = row.ServiceStaff || row;
        try {
            await datastore.table(TABLES.SERVICE_STAFF).deleteRow(ss.ROWID);
            removed.push(ss.staff_id);
        } catch (err) {
            console.error(`Failed to unassign staff ${ss.staff_id} from service ${serviceId}:`, err.message);
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
    const svcResult = await queryByWorkspace(req, TABLES.SERVICES, ` AND service_id = '${serviceId}'`);
    if (!svcResult || svcResult.length === 0) {
        throw new NotFoundError('Service', serviceId);
    }

    const svcData = svcResult[0].Services || svcResult[0];
    const svcType = svcData.service_type;
    const isResource = svcType === SERVICE_TYPES.RESOURCE;

    if (!isResource && (!Array.isArray(staffIds) || staffIds.length === 0)) {
        throw new ValidationError('At least one employee must be assigned to this service.');
    }

    // Delete all existing assignments
    const existingResult = await queryByWorkspace(req, TABLES.SERVICE_STAFF, ` AND service_id = '${serviceId}'`);

    const datastore = getDatastore(req);
    for (const row of existingResult) {
        const ss = row.ServiceStaff || row;
        try {
            await datastore.table(TABLES.SERVICE_STAFF).deleteRow(ss.ROWID);
        } catch (err) {
            console.error('Failed to remove old staff assignment:', err.message);
        }
    }

    // Insert new assignments using resilient insert helper
    const staffTable = datastore.table(TABLES.SERVICE_STAFF);
    const orgId = await resolveOrganizationId(req);
    const assigned = [];
    const safeStaffIds = Array.isArray(staffIds) ? staffIds : [];
    for (const staffId of safeStaffIds) {
        const result = await insertServiceStaffRow(staffTable, {
            service_id: toBigInt(serviceId),
            staff_id: toBigInt(staffId),
            workspace_id: toBigInt(req.workspaceId),
            organization_id: orgId,
        });
        if (result.success) {
            assigned.push(staffId);
        } else {
            console.error(`[ServicesService] replaceStaff: Failed to assign staff ${staffId}: ${result.error}`);
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
 * Look up a user by staff_id using multiple strategies.
 * The staff_id stored in ServiceStaff may be:
 *   - The Users table ROWID (ideal)
 *   - The custom user_id column (from Date.now() during onboarding)
 *   - A value within ±10 of either (onboarding off-by-N bug)
 *
 * We batch-fetch all users and use the same fuzzy matching as UsersService.
 */
let _cachedUsers = null;
let _cachedUsersAt = 0;
const getAllUsersCached = async (req) => {
    // Cache users for 5 seconds to avoid N+1 queries within the same request
    const now = Date.now();
    if (_cachedUsers && (now - _cachedUsersAt) < 5000) return _cachedUsers;
    try {
        const result = await executeZCQL(req, `SELECT * FROM ${TABLES.USERS}`);
        _cachedUsers = result.map(row => row.Users || row);
        _cachedUsersAt = now;
    } catch (e) {
        console.warn('[ServicesService] Failed to fetch all users:', e.message);
        _cachedUsers = [];
        _cachedUsersAt = now;
    }
    return _cachedUsers;
};

const findUserByStaffId = (allUsers, staffId) => {
    if (!staffId) return null;
    const sid = String(staffId);
    const sidNum = parseInt(sid, 10);

    // Strategy A: Exact match on ROWID
    let found = allUsers.find(u => String(u.ROWID) === sid);
    if (found) return found;

    // Strategy B: Exact match on custom user_id column
    found = allUsers.find(u => String(u.user_id) === sid);
    if (found) return found;

    // Strategy C: Fuzzy — ROWID or user_id within ±10
    if (!isNaN(sidNum)) {
        let bestMatch = null;
        let bestDist = Infinity;
        for (const u of allUsers) {
            const rowIdNum = parseInt(String(u.ROWID), 10);
            if (!isNaN(rowIdNum)) {
                const dist = Math.abs(rowIdNum - sidNum);
                if (dist <= 10 && dist < bestDist) {
                    bestDist = dist;
                    bestMatch = u;
                }
            }
            const customIdNum = parseInt(String(u.user_id), 10);
            if (!isNaN(customIdNum)) {
                const dist2 = Math.abs(customIdNum - sidNum);
                if (dist2 <= 10 && dist2 < bestDist) {
                    bestDist = dist2;
                    bestMatch = u;
                }
            }
        }
        if (bestMatch) {
            console.log(`[ServicesService] Fuzzy matched staff_id=${staffId} → User ROWID=${bestMatch.ROWID} (dist=${bestDist})`);
            return bestMatch;
        }
    }

    return null;
};

/**
 * Get staff assigned to a specific service with user details.
 * Uses batch user fetch + multi-strategy ID matching for reliability.
 */
const getServiceStaff = async (req, serviceId) => {
    // Verify service exists
    const svcResult = await queryByWorkspace(req, TABLES.SERVICES, ` AND service_id = '${serviceId}'`);
    if (!svcResult || svcResult.length === 0) {
        throw new NotFoundError('Service', serviceId);
    }

    // Fetch staff assignments using multi-strategy workspace lookup
    const ssResult = await queryByWorkspace(req, TABLES.SERVICE_STAFF, ` AND service_id = '${serviceId}'`);

    console.log(`[ServicesService] getServiceStaff: service_id=${serviceId}, found ${ssResult.length} ServiceStaff rows`);

    // Batch-fetch all users for efficient multi-strategy matching
    const allUsers = await getAllUsersCached(req);

    const staffList = [];
    for (const row of ssResult) {
        const ss = row.ServiceStaff || row;
        const staffId = ss.staff_id;
        const userInfo = findUserByStaffId(allUsers, staffId);

        staffList.push({
            staff_id: staffId,
            name: userInfo?.display_name || 'Unknown',
            email: userInfo?.email || '',
            phone: userInfo?.phone || '',
            designation: userInfo?.designation || '',
            color: userInfo?.color || '#E0E7FF',
            initials: userInfo?.initials || '',
            status: userInfo?.status || 'active',
            // Include the resolved ROWID so the frontend can reliably match
            user_rowid: userInfo?.ROWID || staffId,
        });
    }

    return staffList;
};

const remove = async (req, serviceId) => {
    const existing = await queryByWorkspace(req, TABLES.SERVICES, ` AND service_id = '${serviceId}'`);
    if (!existing || existing.length === 0) {
        throw new NotFoundError('Service', serviceId);
    }

    const datastore = getDatastore(req);

    // Also delete all ServiceStaff assignments for this service
    try {
        const ssResult = await queryByWorkspace(req, TABLES.SERVICE_STAFF, ` AND service_id = '${serviceId}'`);
        for (const row of ssResult) {
            const ss = row.ServiceStaff || row;
            await datastore.table(TABLES.SERVICE_STAFF).deleteRow(ss.ROWID);
        }
    } catch (err) {
        console.error('Error cleaning up ServiceStaff during service deletion:', err.message);
    }

    const svcRow = existing[0].Services || existing[0];
    await datastore.table(TABLES.SERVICES).deleteRow(svcRow.ROWID);

    await insertAuditLog(req, {
        workspaceId: req.workspaceId,
        userId: req.user.user_id,
        action: AUDIT_ACTIONS.SVC_DELETED,
        resourceType: TABLES.SERVICES,
        resourceId: serviceId,
    });
};

/**
 * Get a service by its service_id for public booking — no workspace context needed.
 * Queries the Services table directly without workspace scoping.
 * Returns only the fields needed for the public booking page.
 */
const getPublicById = async (req, serviceId) => {
    let service = null;

    try {
        const query = `SELECT * FROM ${TABLES.SERVICES} WHERE service_id = '${serviceId}' LIMIT 1`;
        const result = await executeZCQL(req, query);

        if (result.length === 0) {
            // Fallback: try by ROWID
            const fallbackQuery = `SELECT * FROM ${TABLES.SERVICES} WHERE ROWID = '${serviceId}' LIMIT 1`;
            const fallbackResult = await executeZCQL(req, fallbackQuery);
            if (fallbackResult.length === 0) {
                throw new NotFoundError('Service', serviceId);
            }
            service = fallbackResult[0].Services || fallbackResult[0];
        } else {
            service = result[0].Services || result[0];
        }
    } catch (err) {
        if (err instanceof NotFoundError) throw err;
        console.error('[ServicesService] getPublicById: Error fetching service:', err.message);
        throw new NotFoundError('Service', serviceId);
    }

    return {
        id: service.service_id || service.ROWID,
        service_id: service.service_id || service.ROWID,
        name: service.service_name || '',
        service_name: service.service_name || '',
        description: service.description || '',
        duration_minutes: parseInt(service.duration_minutes, 10) || 60,
        price: service.price || '0',
        service_type: service.service_type || 'one-on-one',
        meeting_mode: service.meeting_mode || 'Online',
        meeting_location: service.meeting_location || '',
        seats: parseInt(service.seats, 10) || 1,
        status: service.status || 'active',
    };
};

module.exports = { getAll, getById, getPublicById, create, update, remove, assignStaff, unassignStaff, replaceStaff, getServiceStaff };
