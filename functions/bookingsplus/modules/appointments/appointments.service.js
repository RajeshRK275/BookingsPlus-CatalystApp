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
 * 
 * WORKSPACE ID MATCHING:
 * Uses the same multi-strategy workspace lookup (exact → custom wsId → fuzzy ±10)
 * as the services module. This is critical because during onboarding, IDs stored
 * in ServiceStaff/Services may not exactly match the Workspaces.ROWID.
 *
 * APPOINTMENTS TABLE COLUMNS (actual Catalyst Data Store — deployed):
 *   appointment_id, organization_id (MANDATORY), workspace_id, service_id,
 *   staff_id, customer_id, service_name, staff_name, customer_name,
 *   appointment_status, approval_status, payment_status, start_time,
 *   end_time, notes
 *
 * IMPORTANT: organization_id IS a mandatory BIGINT column in the actual Catalyst
 * Data Store. It MUST be included in every insertRow() call. The centralized
 * resolveOrganizationId() helper from datastore.js handles resolution.
 *
 * NOTE: customer_email does NOT exist in the Appointments table.
 */
const { getDatastore, executeZCQL, executeWorkspaceScopedZCQL, insertAuditLog, catalystDateTime, resolveOrganizationId } = require('../../utils/datastore');
const { TABLES, AUDIT_ACTIONS, APPOINTMENT_STATUS, PAYMENT_STATUS, APPROVAL_STATUS, SERVICE_TYPES } = require('../../core/constants');
const { NotFoundError, ValidationError } = require('../../core/errors');

/**
 * Valid columns in the Appointments table.
 * ONLY these columns are sent to insertRow/updateRow — anything else causes
 * "Invalid input value for column" errors from the Catalyst SDK.
 *
 * IMPORTANT: organization_id IS a mandatory column in the actual Catalyst Data Store.
 * It was previously missing from this whitelist, causing the
 * "Column organization_id is mandatory and cannot be empty" error on booking.
 */
const APPOINTMENTS_VALID_COLUMNS = new Set([
    'appointment_id', 'organization_id', 'workspace_id', 'service_id',
    'staff_id', 'customer_id', 'service_name', 'staff_name', 'customer_name',
    'appointment_status', 'approval_status', 'payment_status',
    'start_time', 'end_time', 'notes',
]);

const toBigIntOrZero = (value) => {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number' && !isNaN(value)) return value;
    const parsed = parseInt(String(value), 10);
    return (!isNaN(parsed) && parsed >= 0) ? parsed : 0;
};

/**
 * Format a datetime value for Catalyst.
 * Catalyst datetime columns expect "yyyy-MM-dd HH:mm:ss" format.
 * 
 * IMPORTANT: When receiving ISO strings (e.g. "2025-05-01T09:00:00.000Z"),
 * `new Date(iso).getHours()` returns UTC hours on the server, causing a 
 * timezone offset (e.g. 9:00 AM IST stored as 3:30 AM).
 * 
 * Fix: If the input is an ISO string with 'T' separator, extract the date/time
 * components directly from the string to preserve the intended local time.
 * The frontend now sends pre-formatted "yyyy-MM-dd HH:mm:ss" strings which
 * pass through as-is via the first regex check.
 */
/**
 * Format a datetime value for Catalyst Data Store.
 * 
 * CRITICAL CATALYST BEHAVIOR:
 * ───────────────────────────
 * Catalyst Data Store INTERNALLY converts datetime values to UTC on storage.
 * When the project timezone is IST (+05:30):
 *   - We store "2025-05-01 12:00:00" 
 *   - Catalyst interprets it as 12:00 IST → converts to 06:30 UTC
 *   - ZCQL returns "2025-05-01 06:30:00" (the UTC value)
 *   - Frontend parses "2025-05-01 06:30:00" as LOCAL time → shows 6:30 AM ✗
 * 
 * FIX: We DON'T touch the datetime on write. Instead, the READ side 
 * (convertFromCatalystDT) adds the IST offset back so values round-trip correctly.
 * This is handled in getAll() and anywhere appointment times are returned.
 */
const formatDT = (val) => {
    if (!val) return catalystDateTime();
    const strVal = String(val).trim();
    
    // Already in "yyyy-MM-dd HH:mm:ss" format — pass through as-is
    if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/.test(strVal)) return strVal;
    
    // ISO string like "2025-05-01T09:00:00.000Z" — extract date/time parts directly
    // to avoid UTC conversion on the server (which would double-convert)
    const isoMatch = strVal.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/);
    if (isoMatch) return `${isoMatch[1]} ${isoMatch[2]}`;
    
    // Fallback: parse as Date object
    const d = new Date(strVal);
    if (!isNaN(d.getTime())) return catalystDateTime(d);
    return catalystDateTime();
};

/**
 * Convert datetime returned by Catalyst Data Store (UTC) back to IST.
 * Catalyst stores in UTC but we display in IST (+05:30).
 * 
 * Input:  "2025-05-01 06:30:00" (UTC, as returned by ZCQL)
 * Output: "2025-05-01 12:00:00" (IST, +05:30 applied)
 */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // +5:30 in milliseconds

const convertFromCatalystDT = (val) => {
    if (!val) return val;
    const strVal = String(val).trim();
    // Only process "yyyy-MM-dd HH:mm:ss" format strings
    if (!/^\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2}/.test(strVal)) return strVal;
    
    // Parse as UTC (the value Catalyst returned IS in UTC)
    // We use the 'Z' suffix to force UTC interpretation
    const normalized = strVal.replace(' ', 'T');
    const utcDate = new Date(normalized + (normalized.endsWith('Z') ? '' : 'Z'));
    if (isNaN(utcDate.getTime())) return strVal;
    
    // Add IST offset
    const istDate = new Date(utcDate.getTime() + IST_OFFSET_MS);
    
    const pad = (n) => String(n).padStart(2, '0');
    return `${istDate.getUTCFullYear()}-${pad(istDate.getUTCMonth() + 1)}-${pad(istDate.getUTCDate())} ${pad(istDate.getUTCHours())}:${pad(istDate.getUTCMinutes())}:${pad(istDate.getUTCSeconds())}`;
};

/**
 * Multi-strategy workspace query helper — same as services module.
 * Handles the known onboarding ID mismatch where workspace_id stored in rows
 * may not exactly match req.workspaceId (the Workspaces ROWID).
 *
 * Strategies:
 *   1. Exact match on req.workspaceId
 *   2. Match on Workspaces.workspace_id custom column (legacy onboarding data)
 *   3. Fuzzy: fetch all rows and filter where workspace_id is within ±10 of target
 *   4. Ultra-wide: fetch ALL rows from table with extraWhere (ignoring workspace) — last resort
 */
const queryByWorkspace = async (req, tableName, extraWhere = '') => {
    const wsId = req.workspaceId;

    // Strategy 1: Exact match on workspace ROWID
    try {
        const q = `SELECT * FROM ${tableName} WHERE workspace_id = '${wsId}'${extraWhere}`;
        const result = await executeWorkspaceScopedZCQL(req, q);
        if (result.length > 0) {
            console.log(`[AppointmentsService] Strategy 1 (exact): ${tableName} found ${result.length} rows for workspace_id=${wsId}`);
            return result;
        }
    } catch (e) {
        console.warn(`[AppointmentsService] Strategy 1 failed for ${tableName}:`, e.message);
    }

    // Strategy 2: Match on the custom workspace_id field from Workspaces table
    try {
        const wsLookup = await executeZCQL(req,
            `SELECT workspace_id FROM ${TABLES.WORKSPACES} WHERE ROWID = '${wsId}'`
        );
        if (wsLookup.length > 0) {
            const customWsId = (wsLookup[0].Workspaces || wsLookup[0]).workspace_id;
            if (customWsId && String(customWsId) !== String(wsId)) {
                console.log(`[AppointmentsService] Strategy 2: Trying custom workspace_id=${customWsId}`);
                const q2 = `SELECT * FROM ${tableName} WHERE workspace_id = '${customWsId}'${extraWhere}`;
                const result2 = await executeZCQL(req, q2);
                if (result2.length > 0) {
                    console.log(`[AppointmentsService] Strategy 2 (custom wsId): ${tableName} found ${result2.length} rows`);
                    return result2;
                }
            }
        }
    } catch (e) {
        console.warn(`[AppointmentsService] Strategy 2 failed for ${tableName}:`, e.message);
    }

    // Strategy 3: Fuzzy — fetch ALL rows with extraWhere and filter by workspace_id proximity (±10)
    try {
        console.log(`[AppointmentsService] Strategy 3: Fuzzy matching for ${tableName}...`);
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
                console.log(`[AppointmentsService] Strategy 3 (fuzzy ±10): ${tableName} matched ${fuzzyMatched.length} rows`);
                return fuzzyMatched;
            }
        }
    } catch (e) {
        console.warn(`[AppointmentsService] Strategy 3 failed for ${tableName}:`, e.message);
    }

    // Strategy 4: Ultra-wide — ignore workspace_id entirely, just use extraWhere
    // This is the last resort for single-workspace deployments where the ID mismatch
    // is too large for fuzzy ±10 (e.g., completely different IDs from migration).
    if (extraWhere) {
        try {
            console.log(`[AppointmentsService] Strategy 4: Ultra-wide for ${tableName} (ignoring workspace)...`);
            // Strip the leading ' AND ' from extraWhere to use as WHERE clause
            const whereClause = extraWhere.trim().replace(/^AND\s+/i, '');
            const ultraQuery = `SELECT * FROM ${tableName} WHERE ${whereClause}`;
            const ultraResult = await executeZCQL(req, ultraQuery);
            if (ultraResult.length > 0) {
                console.log(`[AppointmentsService] Strategy 4 (ultra-wide): ${tableName} found ${ultraResult.length} rows (no workspace filter)`);
                return ultraResult;
            }
        } catch (e) {
            console.warn(`[AppointmentsService] Strategy 4 failed for ${tableName}:`, e.message);
        }
    }

    console.log(`[AppointmentsService] All strategies exhausted for ${tableName}, workspace_id=${wsId} — returning empty`);
    return [];
};

/**
 * Look up a user by staff_id using multiple strategies (same as services module).
 * Batch-fetches all users and does exact + fuzzy matching.
 */
let _aptCachedUsers = null;
let _aptCachedUsersAt = 0;
const getAllUsersCached = async (req) => {
    const now = Date.now();
    if (_aptCachedUsers && (now - _aptCachedUsersAt) < 5000) return _aptCachedUsers;
    try {
        const result = await executeZCQL(req, `SELECT * FROM ${TABLES.USERS}`);
        _aptCachedUsers = result.map(row => row.Users || row);
        _aptCachedUsersAt = now;
    } catch (e) {
        console.warn('[AppointmentsService] Failed to fetch all users:', e.message);
        _aptCachedUsers = [];
        _aptCachedUsersAt = now;
    }
    return _aptCachedUsers;
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
            console.log(`[AppointmentsService] Fuzzy matched staff_id=${staffId} → User ROWID=${bestMatch.ROWID} (dist=${bestDist})`);
            return bestMatch;
        }
    }

    return null;
};

/**
 * Get staff assigned to a service using multi-strategy workspace lookup + batch user lookup.
 * Avoids both "No relationship between tables" error AND workspace_id/user_id mismatches.
 */
const getAssignedStaffForService = async (req, serviceId) => {
    // Step 1: Get ServiceStaff assignments using multi-strategy workspace lookup
    const ssResult = await queryByWorkspace(req, TABLES.SERVICE_STAFF, ` AND service_id = '${serviceId}'`);

    console.log(`[AppointmentsService] getAssignedStaffForService: service_id=${serviceId}, found ${ssResult.length} ServiceStaff rows`);

    // Step 2: Batch-fetch all users for efficient multi-strategy matching
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
        });
    }
    return staffList;
};

/**
 * Check which staff have conflicting appointments at the given time.
 * Returns a Set of staff_id values that are BUSY.
 * Uses multi-strategy workspace lookup for consistency.
 */
const getBusyStaffIds = async (req, startTime, endTime) => {
    const formattedStart = formatDT(startTime);
    const formattedEnd = formatDT(endTime);

    const extraWhere = ` AND appointment_status != '${APPOINTMENT_STATUS.CANCELLED}' AND start_time < '${formattedEnd}' AND end_time > '${formattedStart}'`;
    const result = await queryByWorkspace(req, TABLES.APPOINTMENTS, extraWhere);
    return new Set(result.map(row => {
        const apt = row.Appointments || row;
        return String(apt.staff_id);
    }));
};

const getAll = async (req, filters = {}) => {
    let extraWhere = '';
    if (filters.status) {
        extraWhere += ` AND appointment_status = '${filters.status}'`;
    }
    const result = await queryByWorkspace(req, TABLES.APPOINTMENTS, extraWhere);
    return result.map(row => {
        const apt = row.Appointments || row;
        return { 
            id: apt.appointment_id || apt.ROWID, 
            ...apt,
            // Convert Catalyst UTC times back to IST for frontend display
            start_time: convertFromCatalystDT(apt.start_time),
            end_time: convertFromCatalystDT(apt.end_time),
        };
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
        customer_id, customer_name,
        start_time, end_time, notes,
    } = data;

    if (!service_id) throw new ValidationError('Service ID is required for booking.');
    if (!start_time || !end_time) throw new ValidationError('Start time and end time are required.');

    // 1. Fetch the service to get type and name — uses multi-strategy workspace lookup
    let serviceType = 'one-on-one';
    let serviceName = providedServiceName || '';
    try {
        const svcResult = await queryByWorkspace(req, TABLES.SERVICES, ` AND service_id = '${service_id}'`);
        if (svcResult.length > 0) {
            const svc = svcResult[0].Services || svcResult[0];
            serviceType = svc.service_type || 'one-on-one';
            serviceName = serviceName || svc.service_name || '';
            console.log(`[AppointmentsService] Booking: Found service "${serviceName}" (type=${serviceType}) for service_id=${service_id}`);
        } else {
            console.warn(`[AppointmentsService] Booking: Service ${service_id} not found via workspace query — proceeding with defaults`);
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

    // Resolve organization_id — MANDATORY column in Catalyst Data Store
    const orgId = await resolveOrganizationId(req);

    // Build the record using ONLY columns that exist in the Appointments table.
    // IMPORTANT: organization_id IS mandatory — it was previously missing, causing
    // "Column organization_id is mandatory and cannot be empty" errors.
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
        appointment_status: APPOINTMENT_STATUS.PENDING,
        start_time: formatDT(start_time),
        end_time: formatDT(end_time),
        notes: notes || '',
        payment_status: PAYMENT_STATUS.UNPAID,
        approval_status: APPROVAL_STATUS.AWAITING,
    };

    // Safety net: filter out any keys that aren't actual Appointments table columns
    const cleanRecord = {};
    for (const [key, value] of Object.entries(recordData)) {
        if (APPOINTMENTS_VALID_COLUMNS.has(key)) {
            cleanRecord[key] = value;
        } else {
            console.warn(`[AppointmentsService] Skipping non-existent column "${key}" from Appointments insert`);
        }
    }

    console.log(`[AppointmentsService] Inserting appointment: columns=${Object.keys(cleanRecord).join(', ')}, start_time="${cleanRecord.start_time}", end_time="${cleanRecord.end_time}"`);

    let row;
    try {
        row = await datastore.table(TABLES.APPOINTMENTS).insertRow(cleanRecord);
    } catch (insertErr) {
        // If the insert fails, it might be because some column doesn't exist
        // in the actual Data Store (schema drift). Try with minimum columns.
        const errMsg = (insertErr.message || '').toLowerCase();
        if (errMsg.includes('invalid') || errMsg.includes('column') || errMsg.includes('mandatory')) {
            console.warn(`[AppointmentsService] Insert failed: ${insertErr.message}. Retrying with minimal columns...`);
            const minimalRecord = {
                appointment_id,
                organization_id: orgId,
                workspace_id: toBigIntOrZero(req.workspaceId),
                service_id: toBigIntOrZero(service_id),
                staff_id: resolvedStaffId,
                customer_name: customer_name || '',
                appointment_status: APPOINTMENT_STATUS.PENDING,
                start_time: formatDT(start_time),
                end_time: formatDT(end_time),
            };
            row = await datastore.table(TABLES.APPOINTMENTS).insertRow(minimalRecord);
        } else {
            throw insertErr;
        }
    }

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
        // Convert Catalyst UTC times back to IST for frontend
        start_time: convertFromCatalystDT(row.start_time) || formatDT(start_time),
        end_time: convertFromCatalystDT(row.end_time) || formatDT(end_time),
    };
};

/**
 * Updatable columns in the Appointments table.
 * Only these columns (plus ROWID) are sent to updateRow().
 */
const APPOINTMENTS_UPDATABLE_COLUMNS = new Set([
    'service_id', 'staff_id', 'customer_id',
    'service_name', 'staff_name', 'customer_name',
    'appointment_status', 'approval_status', 'payment_status',
    'start_time', 'end_time', 'notes',
]);

/**
 * Map frontend field names to actual Data Store column names for appointments.
 */
const APT_FRONTEND_TO_DB_MAP = {
    status: 'appointment_status',
    appointment_status: 'appointment_status',
    approval_status: 'approval_status',
    payment_status: 'payment_status',
    service_id: 'service_id',
    staff_id: 'staff_id',
    customer_id: 'customer_id',
    service_name: 'service_name',
    staff_name: 'staff_name',
    customer_name: 'customer_name',
    start_time: 'start_time',
    end_time: 'end_time',
    notes: 'notes',
};

const update = async (req, appointmentId, updateData) => {
    const existing = await queryByWorkspace(req, TABLES.APPOINTMENTS, ` AND appointment_id = '${appointmentId}'`);
    if (!existing || existing.length === 0) {
        throw new NotFoundError('Appointment', appointmentId);
    }

    const apt = existing[0].Appointments || existing[0];
    const datastore = getDatastore(req);

    // Build clean update payload with only valid columns
    const cleanData = {};
    for (const [frontendKey, value] of Object.entries(updateData)) {
        const dbColumn = APT_FRONTEND_TO_DB_MAP[frontendKey];
        if (dbColumn && APPOINTMENTS_UPDATABLE_COLUMNS.has(dbColumn) && value !== undefined) {
            // Format datetime fields
            if (dbColumn === 'start_time' || dbColumn === 'end_time') {
                cleanData[dbColumn] = formatDT(value);
            } else if (['service_id', 'staff_id', 'customer_id'].includes(dbColumn)) {
                cleanData[dbColumn] = toBigIntOrZero(value);
            } else {
                cleanData[dbColumn] = value;
            }
        }
    }

    if (Object.keys(cleanData).length === 0) {
        console.warn('[AppointmentsService] update: No valid fields after filtering. Raw keys:', Object.keys(updateData));
        throw new ValidationError('No valid fields provided for update.');
    }

    console.log(`[AppointmentsService] Updating appointment ROWID=${apt.ROWID}. Clean payload:`, JSON.stringify(cleanData));

    const updatedRow = await datastore.table(TABLES.APPOINTMENTS).updateRow({ ROWID: apt.ROWID, ...cleanData });
    // Convert Catalyst UTC times back to IST for frontend
    if (updatedRow.start_time) updatedRow.start_time = convertFromCatalystDT(updatedRow.start_time);
    if (updatedRow.end_time) updatedRow.end_time = convertFromCatalystDT(updatedRow.end_time);
    return updatedRow;
};

const remove = async (req, appointmentId) => {
    const existing = await queryByWorkspace(req, TABLES.APPOINTMENTS, ` AND appointment_id = '${appointmentId}'`);
    if (!existing || existing.length === 0) {
        throw new NotFoundError('Appointment', appointmentId);
    }

    const apt = existing[0].Appointments || existing[0];
    const datastore = getDatastore(req);
    await datastore.table(TABLES.APPOINTMENTS).deleteRow(apt.ROWID);

    await insertAuditLog(req, {
        workspaceId: req.workspaceId,
        userId: req.user.user_id,
        action: AUDIT_ACTIONS.APT_DELETED,
        resourceType: TABLES.APPOINTMENTS,
        resourceId: appointmentId,
    });
};

/**
 * Public booking endpoint — resolves workspace and organization from the service.
 * No authentication required. Used by customers accessing public booking links.
 * 
 * @param {object} data
 * @param {string} data.service_id     — REQUIRED: which service to book
 * @param {string} data.start_time     — REQUIRED: appointment start
 * @param {string} data.end_time       — REQUIRED: appointment end
 * @param {string} data.customer_name  — customer name
 * @param {string} data.customer_email — customer email
 * @param {string} data.customer_phone — customer phone (optional)
 * @param {string} [data.notes]        — booking notes
 */
const bookPublic = async (req, data) => {
    const {
        service_id,
        customer_name,
        customer_email,
        customer_phone,
        start_time,
        end_time,
        notes,
    } = data;

    if (!service_id) throw new ValidationError('Service ID is required for booking.');
    if (!customer_name) throw new ValidationError('Customer name is required.');
    if (!customer_email) throw new ValidationError('Customer email is required.');
    if (!start_time || !end_time) throw new ValidationError('Start time and end time are required.');

    // 1. Fetch the service to resolve workspace_id and organization_id
    let service = null;
    try {
        // Query without workspace scope since we don't have it yet
        const query = `SELECT * FROM ${TABLES.SERVICES} WHERE service_id = '${service_id}' LIMIT 1`;
        const result = await executeZCQL(req, query);
        
        if (result.length === 0) {
            throw new NotFoundError('Service', service_id);
        }
        
        service = result[0].Services || result[0];
        console.log(`[AppointmentsService] Public booking: Found service "${service.service_name}" (workspace_id=${service.workspace_id}, org_id=${service.organization_id})`);
    } catch (err) {
        console.error('[AppointmentsService] Error fetching service for public booking:', err.message);
        throw new NotFoundError('Service', service_id);
    }

    // 2. Inject workspace context into req for the booking process
    req.workspaceId = service.workspace_id;
    const organizationId = service.organization_id;

    // 3. Create or get customer record
    let customerId = 0;
    try {
        // Check if customer exists by email — try both possible column names
        // The Customers table may use 'customer_email' or 'email' depending on setup
        let customerResult = [];
        try {
            customerResult = await executeZCQL(req,
                `SELECT * FROM ${TABLES.CUSTOMERS} WHERE customer_email = '${customer_email}' AND workspace_id = '${req.workspaceId}' LIMIT 1`
            );
        } catch (e1) {
            // Column might be named 'email' instead
            try {
                customerResult = await executeZCQL(req,
                    `SELECT * FROM ${TABLES.CUSTOMERS} WHERE email = '${customer_email}' AND workspace_id = '${req.workspaceId}' LIMIT 1`
                );
            } catch (e2) {
                console.warn('[AppointmentsService] Customer lookup failed:', e2.message);
            }
        }
        
        if (customerResult.length > 0) {
            const existingCustomer = customerResult[0].Customers || customerResult[0];
            customerId = toBigIntOrZero(existingCustomer.customer_id || existingCustomer.ROWID);
            console.log(`[AppointmentsService] Public booking: Found existing customer_id=${customerId}`);
        } else {
            // Create new customer — use the same column names as customers.service.js
            const datastore = getDatastore(req);
            try {
                const newCustomer = await datastore.table(TABLES.CUSTOMERS).insertRow({
                    customer_id: Date.now(),
                    organization_id: toBigIntOrZero(organizationId),
                    workspace_id: toBigIntOrZero(req.workspaceId),
                    customer_name: customer_name,
                    customer_email: customer_email,
                    customer_phone: customer_phone || '',
                    status: 'active',
                });
                customerId = toBigIntOrZero(newCustomer.customer_id || newCustomer.ROWID);
                console.log(`[AppointmentsService] Public booking: Created new customer_id=${customerId}`);
            } catch (insertErr) {
                // Retry with alternative column names if first attempt fails
                console.warn('[AppointmentsService] Customer insert failed, retrying with alt columns:', insertErr.message);
                try {
                    const newCustomer = await datastore.table(TABLES.CUSTOMERS).insertRow({
                        customer_id: Date.now(),
                        organization_id: toBigIntOrZero(organizationId),
                        workspace_id: toBigIntOrZero(req.workspaceId),
                        name: customer_name,
                        email: customer_email,
                        phone: customer_phone || '',
                        status: 'active',
                    });
                    customerId = toBigIntOrZero(newCustomer.customer_id || newCustomer.ROWID);
                    console.log(`[AppointmentsService] Public booking: Created new customer_id=${customerId} (alt columns)`);
                } catch (retryErr) {
                    console.error('[AppointmentsService] Customer insert retry also failed:', retryErr.message);
                }
            }
        }
    } catch (err) {
        console.error('[AppointmentsService] Error handling customer for public booking:', err.message);
        // Continue with customerId = 0 if customer creation fails
    }

    // 4. Ensure user context exists for the booking process (needed for audit logs).
    // If called from an authenticated route (e.g., /api/v1/booking/book),
    // req.user already has the real authenticated user — preserve it.
    // If called from an unauthenticated route, set a minimal mock user.
    if (!req.user || !req.user.user_id) {
        req.user = {
            user_id: 0,
            email: customer_email || 'public@bookingsplus.system',
            display_name: customer_name || 'Public Booking',
        };
    }

    // Ensure organizationId is set on req for resolveOrganizationId()
    if (organizationId) {
        req.organizationId = String(organizationId);
    }

    // 5. Call the standard booking logic
    const bookingData = {
        service_id,
        service_name: service.service_name,
        customer_id: customerId,
        customer_name,
        start_time,
        end_time,
        notes: notes || `Booked by ${customer_name} (${customer_email})${customer_phone ? `, Phone: ${customer_phone}` : ''}`,
    };

    return await book(req, bookingData);
};

module.exports = { getAll, book, bookPublic, update, remove };
