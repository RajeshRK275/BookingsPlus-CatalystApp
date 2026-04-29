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
 * Get all users in a workspace using SEPARATE queries (no JOINs).
 * 
 * IMPORTANT: Catalyst ZCQL JOINs require explicit table relationships to be
 * configured in the Data Store settings. If those relationships are missing,
 * JOIN queries fail with "No relationship between tables X and Y".
 * We use separate queries to avoid this hard dependency.
 */
const getWorkspaceUsers = async (req) => {
    // Step 1: Get all active memberships in this workspace
    const uwResult = await executeWorkspaceScopedZCQL(req,
        `SELECT * FROM ${TABLES.USER_WORKSPACES} WHERE workspace_id = '${req.workspaceId}' AND status = 'active'`
    );

    const memberships = uwResult.map(row => row.UserWorkspaces || row);
    if (memberships.length === 0) return [];

    // Step 2: For each membership, fetch user details and role details separately
    const users = [];
    for (const uw of memberships) {
        const userId = uw.user_id;
        if (!userId) continue;

        // Fetch user details
        let userInfo = {};
        try {
            const userResult = await executeZCQL(req,
                `SELECT * FROM ${TABLES.USERS} WHERE ROWID = '${userId}'`
            );
            if (userResult.length > 0) {
                userInfo = userResult[0].Users || userResult[0];
            }
        } catch (e) {
            console.warn(`[UsersService] Failed to fetch user ${userId}:`, e.message);
        }

        // Fetch role details
        let roleName = 'Staff';
        let roleLevel = 0;
        if (uw.role_id) {
            try {
                const roleResult = await executeZCQL(req,
                    `SELECT role_name, role_level FROM ${TABLES.ROLES} WHERE ROWID = '${uw.role_id}'`
                );
                if (roleResult.length > 0) {
                    const role = roleResult[0].Roles || roleResult[0];
                    roleName = role.role_name || 'Staff';
                    roleLevel = parseInt(role.role_level) || 0;
                }
            } catch (e) {
                console.warn(`[UsersService] Failed to fetch role ${uw.role_id}:`, e.message);
            }
        }

        users.push({
            id: userId,
            user_id: userId,
            name: userInfo.display_name,
            email: userInfo.email,
            phone: userInfo.phone,
            designation: userInfo.designation,
            gender: userInfo.gender,
            dob: userInfo.dob,
            color: userInfo.color || '#E0E7FF',
            initials: userInfo.initials,
            status: userInfo.status,
            is_super_admin: userInfo.is_super_admin,
            role: roleName,
            role_name: roleName,
            role_level: roleLevel,
            role_id: uw.role_id,
        });
    }

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

    // Determine role
    let assignedRoleId = role_id;
    if (!assignedRoleId) {
        const staffRoleResult = await executeWorkspaceScopedZCQL(req,
            `SELECT ${TABLES.ROLES}.ROWID FROM ${TABLES.ROLES} WHERE ${TABLES.ROLES}.workspace_id = '${req.workspaceId}' AND ${TABLES.ROLES}.role_name = 'Staff'`
        );
        assignedRoleId = staffRoleResult.length > 0 ? staffRoleResult[0].Roles.ROWID : null;
    }

    // Check existing membership
    const existingMembership = await executeWorkspaceScopedZCQL(req,
        `SELECT ${TABLES.USER_WORKSPACES}.ROWID FROM ${TABLES.USER_WORKSPACES} WHERE ${TABLES.USER_WORKSPACES}.user_id = '${userRowId}' AND ${TABLES.USER_WORKSPACES}.workspace_id = '${req.workspaceId}'`
    );

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
    const membership = await executeWorkspaceScopedZCQL(req,
        `SELECT ${TABLES.USER_WORKSPACES}.ROWID FROM ${TABLES.USER_WORKSPACES} WHERE ${TABLES.USER_WORKSPACES}.user_id = '${userId}' AND ${TABLES.USER_WORKSPACES}.workspace_id = '${req.workspaceId}'`
    );

    if (membership.length === 0) {
        throw new NotFoundError('User membership in this workspace');
    }

    const datastore = getDatastore(req);
    await datastore.table(TABLES.USER_WORKSPACES).deleteRow(membership[0].UserWorkspaces.ROWID);

    await insertAuditLog(req, {
        workspaceId: req.workspaceId,
        userId: req.user.user_id,
        action: AUDIT_ACTIONS.USER_REMOVED,
        resourceType: TABLES.USERS,
        resourceId: userId,
    });
};

module.exports = { getWorkspaceUsers, createAndAssign, updateUser, removeFromWorkspace };
