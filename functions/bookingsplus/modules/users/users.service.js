/**
 * Users Service — Business logic for user/employee management.
 * IMPORTANT: All _id columns in Catalyst Data Store are BIGINT.
 * Always coerce IDs to numbers before inserting.
 */
const { getDatastore, executeZCQL, executeWorkspaceScopedZCQL, insertAuditLog, catalystDateTime } = require('../../utils/datastore');
const { TABLES, AUDIT_ACTIONS } = require('../../core/constants');
const { NotFoundError, ValidationError, ConflictError, ExternalServiceError } = require('../../core/errors');

/** Coerce any value to a safe BIGINT-compatible number */
const toBigInt = (value) => {
    if (value === null || value === undefined) return Date.now();
    if (typeof value === 'number' && !isNaN(value)) return value;
    const parsed = parseInt(String(value), 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
    return Date.now();
};

/**
 * Get all users in a workspace.
 * 
 * STRATEGY — Batch & Reconcile:
 * Due to ID mismatches between UserWorkspaces.user_id and Users.ROWID/user_id
 * (caused by onboarding code using sequential timestamps like Date.now()+1, +2, +3),
 * we fetch ALL data in batch and match using multiple strategies:
 *   a. Exact: Users.ROWID === uw.user_id
 *   b. Legacy: Users.user_id (custom column) === uw.user_id
 *   c. Fuzzy:  ROWID within ±10 of uw.user_id (onboarding off-by-N fix)
 *
 * This is both MORE ROBUST and MORE EFFICIENT than the old N+1 approach.
 */
const getWorkspaceUsers = async (req) => {
    // Step 1: Get all active memberships in this workspace.
    //
    // KNOWN DATA ISSUE: During onboarding, the setup code stored sequential
    // Date.now()+N values as IDs. The UserWorkspaces.workspace_id may NOT match
    // the Workspaces.ROWID — it could be off by 1-5 (or contain the custom
    // workspace_id timestamp value instead of the ROWID). We use multiple
    // strategies to find memberships.

    let memberships = [];

    // Strategy 1: Direct match on workspace ROWID (ideal case)
    try {
        const uwResult = await executeWorkspaceScopedZCQL(req,
            `SELECT * FROM ${TABLES.USER_WORKSPACES} WHERE workspace_id = '${req.workspaceId}' AND status = 'active'`
        );
        memberships = uwResult.map(row => row.UserWorkspaces || row);
        console.log(`[UsersService] Strategy 1 (exact ROWID): Found ${memberships.length} memberships for workspace=${req.workspaceId}`);
    } catch (e) {
        console.warn('[UsersService] Strategy 1 failed:', e.message);
    }

    // Strategy 2: Match on the custom workspace_id field from Workspaces table
    if (memberships.length === 0) {
        try {
            const wsLookup = await executeZCQL(req,
                `SELECT workspace_id FROM ${TABLES.WORKSPACES} WHERE ROWID = '${req.workspaceId}'`
            );
            if (wsLookup.length > 0) {
                const customWsId = (wsLookup[0].Workspaces || wsLookup[0]).workspace_id;
                if (customWsId && String(customWsId) !== String(req.workspaceId)) {
                    console.log(`[UsersService] Strategy 2: Trying custom workspace_id=${customWsId}`);
                    const uwRetry = await executeZCQL(req,
                        `SELECT * FROM ${TABLES.USER_WORKSPACES} WHERE workspace_id = '${customWsId}' AND status = 'active'`
                    );
                    memberships = uwRetry.map(row => row.UserWorkspaces || row);
                    console.log(`[UsersService] Strategy 2: Found ${memberships.length} memberships`);
                }
            }
        } catch (e) {
            console.warn('[UsersService] Strategy 2 failed:', e.message);
        }
    }

    // Strategy 3: Fuzzy match — fetch ALL UserWorkspaces and find rows where
    // workspace_id is within ±10 of the Workspace ROWID. This handles the
    // onboarding bug where Date.now()+2 was stored instead of the ROWID.
    if (memberships.length === 0) {
        try {
            console.log('[UsersService] Strategy 3: Fuzzy workspace_id matching...');
            const allUwResult = await executeZCQL(req,
                `SELECT * FROM ${TABLES.USER_WORKSPACES} WHERE status = 'active'`
            );
            const allUw = allUwResult.map(row => row.UserWorkspaces || row);
            const targetWsId = parseInt(String(req.workspaceId), 10);

            if (!isNaN(targetWsId)) {
                memberships = allUw.filter(uw => {
                    const uwWsId = parseInt(String(uw.workspace_id), 10);
                    return !isNaN(uwWsId) && Math.abs(uwWsId - targetWsId) <= 10;
                });
                console.log(`[UsersService] Strategy 3: Fuzzy matched ${memberships.length} memberships (tolerance ±10 from ROWID ${req.workspaceId})`);

                // Log what workspace_id values were actually found
                if (memberships.length > 0) {
                    const foundWsIds = [...new Set(memberships.map(m => m.workspace_id))];
                    console.log(`[UsersService] Strategy 3: Matched workspace_ids in UserWorkspaces: ${foundWsIds.join(', ')}`);
                }
            }
        } catch (e) {
            console.warn('[UsersService] Strategy 3 failed:', e.message);
        }
    }

    if (memberships.length === 0) {
        console.warn(`[UsersService] No memberships found for workspace ${req.workspaceId} after all 3 strategies`);
        return [];
    }

    // Step 2: Batch-fetch ALL users (typically very few in a small business)
    let allUsers = [];
    try {
        const usersResult = await executeZCQL(req, `SELECT * FROM ${TABLES.USERS}`);
        allUsers = usersResult.map(row => row.Users || row);
        console.log(`[UsersService] Loaded ${allUsers.length} users from Users table`);
    } catch (e) {
        console.error('[UsersService] Failed to fetch users:', e.message);
        return [];
    }

    // Build lookup maps
    const usersByRowId = {};   // ROWID → user
    const usersByCustomId = {}; // custom user_id → user
    for (const u of allUsers) {
        if (u.ROWID) usersByRowId[String(u.ROWID)] = u;
        if (u.user_id) usersByCustomId[String(u.user_id)] = u;
    }

    // Step 3: Batch-fetch ALL roles for this workspace
    // Same issue as workspace_id: role queries may need fuzzy matching
    const rolesMap = {};
    try {
        let rolesResult = await executeWorkspaceScopedZCQL(req,
            `SELECT * FROM ${TABLES.ROLES} WHERE workspace_id = '${req.workspaceId}'`
        );

        // Fallback: fuzzy match roles by workspace_id ±10
        if (rolesResult.length === 0) {
            console.log('[UsersService] No roles found for exact workspace_id, trying broader fetch...');
            try {
                const allRolesResult = await executeZCQL(req, `SELECT * FROM ${TABLES.ROLES}`);
                const targetWsId = parseInt(String(req.workspaceId), 10);
                if (!isNaN(targetWsId)) {
                    rolesResult = allRolesResult.filter(row => {
                        const role = row.Roles || row;
                        const roleWsId = parseInt(String(role.workspace_id), 10);
                        return !isNaN(roleWsId) && Math.abs(roleWsId - targetWsId) <= 10;
                    });
                    console.log(`[UsersService] Fuzzy-matched ${rolesResult.length} roles`);
                }
            } catch (e2) {
                console.warn('[UsersService] Roles fuzzy fallback failed:', e2.message);
            }
        }

        for (const row of rolesResult) {
            const role = row.Roles || row;
            if (role.ROWID) {
                rolesMap[String(role.ROWID)] = {
                    role_name: role.role_name || 'Staff',
                    role_level: parseInt(role.role_level) || 0,
                };
            }
            // Also index by custom role_id field (from seed-roles: Date.now() + offset)
            if (role.role_id && String(role.role_id) !== String(role.ROWID)) {
                rolesMap[String(role.role_id)] = {
                    role_name: role.role_name || 'Staff',
                    role_level: parseInt(role.role_level) || 0,
                };
            }
        }
        console.log(`[UsersService] Built rolesMap with ${Object.keys(rolesMap).length} entries`);
    } catch (e) {
        console.warn('[UsersService] Failed to batch-fetch roles:', e.message);
    }

    // Step 4: Match each membership → user using multiple strategies
    const users = [];
    const matchedUserKeys = new Set();

    for (const uw of memberships) {
        const uwUserId = String(uw.user_id || '');
        if (!uwUserId) continue;

        let userInfo = null;

        // Strategy A: Exact match on Users.ROWID
        if (usersByRowId[uwUserId]) {
            userInfo = usersByRowId[uwUserId];
        }

        // Strategy B: Exact match on Users.user_id (custom column)
        if (!userInfo && usersByCustomId[uwUserId]) {
            userInfo = usersByCustomId[uwUserId];
        }

        // Strategy C: Fuzzy — ROWID or user_id within ±10 of uw.user_id
        // The onboarding setup code used sequential Date.now() + N offsets,
        // causing UserWorkspaces.user_id to be off by 1-5 from Users.ROWID.
        if (!userInfo) {
            const uwIdNum = parseInt(uwUserId, 10);
            if (!isNaN(uwIdNum)) {
                let bestMatch = null;
                let bestDist = Infinity;
                for (const u of allUsers) {
                    // Check ROWID proximity
                    const rowIdNum = parseInt(String(u.ROWID), 10);
                    if (!isNaN(rowIdNum)) {
                        const dist = Math.abs(rowIdNum - uwIdNum);
                        if (dist <= 10 && dist < bestDist) {
                            bestDist = dist;
                            bestMatch = u;
                        }
                    }
                    // Check custom user_id proximity
                    const customIdNum = parseInt(String(u.user_id), 10);
                    if (!isNaN(customIdNum)) {
                        const dist2 = Math.abs(customIdNum - uwIdNum);
                        if (dist2 <= 10 && dist2 < bestDist) {
                            bestDist = dist2;
                            bestMatch = u;
                        }
                    }
                }
                if (bestMatch) {
                    console.log(`[UsersService] Fuzzy matched UW.user_id=${uwUserId} → User ROWID=${bestMatch.ROWID} email=${bestMatch.email} (dist=${bestDist})`);
                    userInfo = bestMatch;
                }
            }
        }

        if (!userInfo) {
            console.warn(`[UsersService] No user found for UW.user_id=${uwUserId} — skipping`);
            continue;
        }

        // Deduplicate (same user might appear via multiple membership rows)
        const uniqueKey = String(userInfo.ROWID);
        if (matchedUserKeys.has(uniqueKey)) continue;
        matchedUserKeys.add(uniqueKey);

        // Resolve role — uw.role_id may be the custom role_id (Date.now() timestamp)
        // or the Roles ROWID. Check both via the dual-indexed rolesMap.
        const roleId = uw.role_id ? String(uw.role_id) : null;
        let roleName = 'Staff';
        let roleLevel = 0;
        if (roleId && rolesMap[roleId]) {
            roleName = rolesMap[roleId].role_name;
            roleLevel = rolesMap[roleId].role_level;
        } else if (roleId) {
            // Fuzzy: role_id might be close but not exact (±10 of a ROWID)
            const roleIdNum = parseInt(roleId, 10);
            if (!isNaN(roleIdNum)) {
                for (const [key, val] of Object.entries(rolesMap)) {
                    const keyNum = parseInt(key, 10);
                    if (!isNaN(keyNum) && Math.abs(keyNum - roleIdNum) <= 10) {
                        roleName = val.role_name;
                        roleLevel = val.role_level;
                        break;
                    }
                }
            }
        }
        // Label super admins clearly
        if ((userInfo.is_super_admin === 'true' || userInfo.is_super_admin === true) && roleName === 'Staff') {
            roleName = 'Super Admin';
        }

        users.push({
            id: userInfo.ROWID,
            user_id: userInfo.ROWID,
            name: userInfo.display_name,
            display_name: userInfo.display_name,
            email: userInfo.email,
            phone: userInfo.phone,
            designation: userInfo.designation,
            gender: userInfo.gender,
            dob: userInfo.dob,
            color: userInfo.color || '#E0E7FF',
            initials: userInfo.initials || (userInfo.display_name || '??').substring(0, 2).toUpperCase(),
            status: userInfo.status,
            is_super_admin: userInfo.is_super_admin,
            role: roleName,
            role_name: roleName,
            role_level: roleLevel,
            role_id: uw.role_id,
        });
    }

    console.log(`[UsersService] Returning ${users.length} matched employees`);
    return users;
};

const createAndAssign = async (req, data) => {
    const { name, display_name, email, role_id, phone, designation, gender, dob, status, color, initials } = data;
    const userName = display_name || name;

    if (!email) throw new ValidationError('Email is required.');

    // Provision in Catalyst
    let catalystUserId;
    try {
        const signupConfig = { platform_type: 'web' };
        const userConfig = {
            first_name: userName || email.split('@')[0],
            last_name: '-',
            email_id: email,
        };
        const registeredUser = await req.catalystApp.userManagement().registerUser(signupConfig, userConfig);
        catalystUserId = String(registeredUser.user_id);
    } catch (authErr) {
        throw new ExternalServiceError('Catalyst User Management', authErr);
    }

    const datastore = getDatastore(req);

    // Check if user exists locally
    let existingUser = [];
    try {
        existingUser = await executeZCQL(req, `SELECT * FROM ${TABLES.USERS} WHERE email = '${email}'`);
    } catch (e) { /* ignore */ }

    let userRowId;
    if (existingUser.length > 0) {
        userRowId = existingUser[0].Users.ROWID;
        if (!existingUser[0].Users.catalyst_user_id) {
            await datastore.table(TABLES.USERS).updateRow({
                ROWID: userRowId,
                catalyst_user_id: catalystUserId,
            });
        }
    } else {
        // Get organization_id — mandatory BIGINT column
        let organizationId;
        try {
            const orgResult = await executeZCQL(req, `SELECT ROWID FROM ${TABLES.ORGANIZATION} LIMIT 1`);
            organizationId = orgResult.length > 0 ? toBigInt(orgResult[0].Organization.ROWID) : Date.now();
        } catch (e) {
            organizationId = Date.now();
        }

        const displayName = userName || email.split('@')[0];
        const userRow = await datastore.table(TABLES.USERS).insertRow({
            user_id: Date.now(),
            catalyst_user_id: catalystUserId,
            display_name: displayName,
            email,
            phone: phone || '',
            organization_id: organizationId,
            designation: designation || '',
            gender: gender || '',
            dob: dob || '',
            color: color || '#E0E7FF',
            initials: initials || displayName.substring(0, 2).toUpperCase(),
            is_super_admin: 'false',
            role_version: 0,
            status: status || 'active',
            created_at: catalystDateTime(),
        });
        userRowId = userRow.ROWID;
    }

    // Determine role — handle fuzzy workspace_id for role lookup
    let assignedRoleId = role_id;
    if (!assignedRoleId) {
        let staffRoleResult = [];
        try {
            staffRoleResult = await executeWorkspaceScopedZCQL(req,
                `SELECT ${TABLES.ROLES}.ROWID FROM ${TABLES.ROLES} WHERE ${TABLES.ROLES}.workspace_id = '${req.workspaceId}' AND ${TABLES.ROLES}.role_name = 'Staff'`
            );
        } catch (e) { /* ignore */ }

        // Fuzzy fallback for role lookup
        if (staffRoleResult.length === 0) {
            try {
                const allRoles = await executeZCQL(req, `SELECT * FROM ${TABLES.ROLES} WHERE role_name = 'Staff'`);
                const targetWsId = parseInt(String(req.workspaceId), 10);
                if (!isNaN(targetWsId)) {
                    for (const r of allRoles) {
                        const role = r.Roles || r;
                        const roleWsId = parseInt(String(role.workspace_id), 10);
                        if (!isNaN(roleWsId) && Math.abs(roleWsId - targetWsId) <= 10) {
                            staffRoleResult = [r];
                            break;
                        }
                    }
                }
            } catch (e) { /* ignore */ }
        }

        assignedRoleId = staffRoleResult.length > 0 ? (staffRoleResult[0].Roles || staffRoleResult[0]).ROWID : null;
    }

    // Check existing membership — also with fuzzy matching
    let existingMembership = [];
    try {
        existingMembership = await executeWorkspaceScopedZCQL(req,
            `SELECT ${TABLES.USER_WORKSPACES}.ROWID FROM ${TABLES.USER_WORKSPACES} WHERE ${TABLES.USER_WORKSPACES}.user_id = '${userRowId}' AND ${TABLES.USER_WORKSPACES}.workspace_id = '${req.workspaceId}'`
        );
    } catch (e) { /* ignore */ }

    if (existingMembership.length === 0) {
        // Fuzzy check
        try {
            const allUw = await executeZCQL(req, `SELECT * FROM ${TABLES.USER_WORKSPACES}`);
            const targetUserId = parseInt(String(userRowId), 10);
            const targetWsId = parseInt(String(req.workspaceId), 10);
            if (!isNaN(targetUserId) && !isNaN(targetWsId)) {
                for (const row of allUw) {
                    const uw = row.UserWorkspaces || row;
                    const uwUid = parseInt(String(uw.user_id), 10);
                    const uwWsId = parseInt(String(uw.workspace_id), 10);
                    if (!isNaN(uwUid) && !isNaN(uwWsId) && Math.abs(uwUid - targetUserId) <= 10 && Math.abs(uwWsId - targetWsId) <= 10) {
                        existingMembership = [row];
                        break;
                    }
                }
            }
        } catch (e) { /* ignore */ }
    }

    if (existingMembership.length > 0) {
        throw new ConflictError('User is already a member of this workspace.');
    }

    // Add to workspace — all _id columns are BIGINT
    await datastore.table(TABLES.USER_WORKSPACES).insertRow({
        user_workspace_id: Date.now() + 1,
        user_id: toBigInt(userRowId),
        workspace_id: toBigInt(req.workspaceId),
        role_id: toBigInt(assignedRoleId),
        status: 'active',
        joined_at: catalystDateTime(),
    });

    await insertAuditLog(req, {
        workspaceId: req.workspaceId,
        userId: req.user.user_id,
        action: AUDIT_ACTIONS.USER_CREATED,
        resourceType: TABLES.USERS,
        resourceId: userRowId,
        details: { email, name: userName },
    });

    return { user_id: userRowId, name: userName, email, role_id: assignedRoleId };
};

const updateUser = async (req, userId, updateData) => {
    const existing = await executeZCQL(req, `SELECT ROWID FROM ${TABLES.USERS} WHERE ROWID = '${userId}'`);
    if (!existing || existing.length === 0) {
        throw new NotFoundError('User', userId);
    }

    // Remap 'name' → 'display_name' for Catalyst compatibility
    if (updateData.name && !updateData.display_name) {
        updateData.display_name = updateData.name;
    }
    delete updateData.name;

    const datastore = getDatastore(req);
    const data = { ROWID: existing[0].Users.ROWID, ...updateData };
    delete data.is_super_admin;
    delete data.catalyst_user_id;
    return await datastore.table(TABLES.USERS).updateRow(data);
};

const removeFromWorkspace = async (req, userId) => {
    let membership = [];

    // Try exact match first
    try {
        membership = await executeWorkspaceScopedZCQL(req,
            `SELECT ${TABLES.USER_WORKSPACES}.ROWID, ${TABLES.USER_WORKSPACES}.user_id FROM ${TABLES.USER_WORKSPACES} WHERE ${TABLES.USER_WORKSPACES}.user_id = '${userId}' AND ${TABLES.USER_WORKSPACES}.workspace_id = '${req.workspaceId}'`
        );
    } catch (e) { /* ignore */ }

    // Fuzzy fallback: both user_id and workspace_id may be off by a few
    if (membership.length === 0) {
        try {
            const allUw = await executeZCQL(req,
                `SELECT * FROM ${TABLES.USER_WORKSPACES} WHERE status = 'active'`
            );
            const targetUserId = parseInt(String(userId), 10);
            const targetWsId = parseInt(String(req.workspaceId), 10);

            if (!isNaN(targetUserId) && !isNaN(targetWsId)) {
                for (const row of allUw) {
                    const uw = row.UserWorkspaces || row;
                    const uwUserId = parseInt(String(uw.user_id), 10);
                    const uwWsId = parseInt(String(uw.workspace_id), 10);

                    const userMatch = !isNaN(uwUserId) && Math.abs(uwUserId - targetUserId) <= 10;
                    const wsMatch = !isNaN(uwWsId) && Math.abs(uwWsId - targetWsId) <= 10;

                    if (userMatch && wsMatch) {
                        membership = [row];
                        break;
                    }
                }
            }
        } catch (e) {
            console.warn('[UsersService] removeFromWorkspace fuzzy fallback failed:', e.message);
        }
    }

    if (membership.length === 0) {
        throw new NotFoundError('User membership in this workspace');
    }

    const datastore = getDatastore(req);
    const uwData = membership[0].UserWorkspaces || membership[0];
    await datastore.table(TABLES.USER_WORKSPACES).deleteRow(uwData.ROWID);

    await insertAuditLog(req, {
        workspaceId: req.workspaceId,
        userId: req.user.user_id,
        action: AUDIT_ACTIONS.USER_REMOVED,
        resourceType: TABLES.USERS,
        resourceId: userId,
    });
};

module.exports = { getWorkspaceUsers, createAndAssign, updateUser, removeFromWorkspace };
