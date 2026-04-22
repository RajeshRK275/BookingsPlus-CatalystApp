/**
 * Users Service — Business logic for user/employee management.
 */
const { getDatastore, executeZCQL, executeWorkspaceScopedZCQL, insertAuditLog } = require('../../utils/datastore');
const { TABLES, AUDIT_ACTIONS } = require('../../core/constants');
const { NotFoundError, ValidationError, ConflictError, ExternalServiceError } = require('../../core/errors');

const getWorkspaceUsers = async (req) => {
    const result = await executeWorkspaceScopedZCQL(req,
        `SELECT uw.user_id, uw.role_id, uw.status as membership_status, 
                u.name, u.email, u.phone, u.designation, u.gender, u.dob, u.color, u.initials, u.status, u.catalyst_user_id, u.is_super_admin,
                r.role_name, r.role_level
         FROM ${TABLES.USER_WORKSPACES} uw
         LEFT JOIN ${TABLES.USERS} u ON uw.user_id = u.ROWID
         LEFT JOIN ${TABLES.ROLES} r ON uw.role_id = r.ROWID
         WHERE uw.workspace_id = '${req.workspaceId}' AND uw.status = 'active'`
    );

    return result.map(row => {
        const uw = row.UserWorkspaces || {};
        const u = row.Users || {};
        const r = row.Roles || {};
        return {
            id: uw.user_id,
            user_id: uw.user_id,
            name: u.name,
            email: u.email,
            phone: u.phone,
            designation: u.designation,
            gender: u.gender,
            dob: u.dob,
            color: u.color || '#E0E7FF',
            initials: u.initials,
            status: u.status,
            is_super_admin: u.is_super_admin,
            role: r.role_name || 'Staff',
            role_name: r.role_name || 'Staff',
            role_level: parseInt(r.role_level) || 0,
            role_id: uw.role_id,
        };
    });
};

const createAndAssign = async (req, data) => {
    const { name, email, role_id, phone, designation, gender, dob, status, color, initials } = data;

    if (!email) throw new ValidationError('Email is required.');

    // Provision in Catalyst
    let catalystUserId;
    try {
        const signupConfig = { platform_type: 'web' };
        const userConfig = {
            first_name: name || email.split('@')[0],
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
        const displayName = name || email.split('@')[0];
        const userRow = await datastore.table(TABLES.USERS).insertRow({
            user_id: Date.now(),
            catalyst_user_id: catalystUserId,
            name: displayName,
            email,
            phone: phone || '',
            designation: designation || '',
            gender: gender || '',
            dob: dob || '',
            color: color || '#E0E7FF',
            initials: initials || displayName.substring(0, 2).toUpperCase(),
            is_super_admin: 'false',
            role_version: 0,
            status: status || 'active',
            created_at: new Date().toISOString(),
        });
        userRowId = userRow.ROWID;
    }

    // Determine role
    let assignedRoleId = role_id;
    if (!assignedRoleId) {
        const staffRoleResult = await executeWorkspaceScopedZCQL(req,
            `SELECT ROWID FROM ${TABLES.ROLES} WHERE workspace_id = '${req.workspaceId}' AND role_name = 'Staff'`
        );
        assignedRoleId = staffRoleResult.length > 0 ? staffRoleResult[0].Roles.ROWID : null;
    }

    // Check existing membership
    const existingMembership = await executeWorkspaceScopedZCQL(req,
        `SELECT ROWID FROM ${TABLES.USER_WORKSPACES} WHERE user_id = '${userRowId}' AND workspace_id = '${req.workspaceId}'`
    );

    if (existingMembership.length > 0) {
        throw new ConflictError('User is already a member of this workspace.');
    }

    // Add to workspace
    await datastore.table(TABLES.USER_WORKSPACES).insertRow({
        user_workspace_id: Date.now() + 1,
        user_id: userRowId,
        workspace_id: req.workspaceId,
        role_id: assignedRoleId || '',
        status: 'active',
        joined_at: new Date().toISOString(),
    });

    await insertAuditLog(req, {
        workspaceId: req.workspaceId,
        userId: req.user.user_id,
        action: AUDIT_ACTIONS.USER_CREATED,
        resourceType: TABLES.USERS,
        resourceId: userRowId,
        details: { email, name },
    });

    return { user_id: userRowId, name, email, role_id: assignedRoleId };
};

const updateUser = async (req, userId, updateData) => {
    const existing = await executeZCQL(req, `SELECT ROWID FROM ${TABLES.USERS} WHERE ROWID = '${userId}'`);
    if (!existing || existing.length === 0) {
        throw new NotFoundError('User', userId);
    }

    const datastore = getDatastore(req);
    const data = { ROWID: existing[0].Users.ROWID, ...updateData };
    delete data.is_super_admin;
    delete data.catalyst_user_id;
    return await datastore.table(TABLES.USERS).updateRow(data);
};

const removeFromWorkspace = async (req, userId) => {
    const membership = await executeWorkspaceScopedZCQL(req,
        `SELECT ROWID FROM ${TABLES.USER_WORKSPACES} WHERE user_id = '${userId}' AND workspace_id = '${req.workspaceId}'`
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
