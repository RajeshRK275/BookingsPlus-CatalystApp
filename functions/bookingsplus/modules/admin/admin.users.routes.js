const express = require('express');
const router = express.Router();
const { getDatastore, executeZCQL, insertAuditLog, catalystDateTime } = require('../../utils/datastore');

// All routes guarded by superAdminGuard in index.js

/** Coerce any value to a safe BIGINT-compatible number for Catalyst Data Store */
const toBigInt = (value) => {
    if (value === null || value === undefined) return Date.now();
    if (typeof value === 'number' && !isNaN(value)) return value;
    const parsed = parseInt(String(value), 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
    return Date.now();
};

// GET / — List all users across the entire deployment
router.get('/', async (req, res, next) => {
    try {
        const result = await executeZCQL(req, 'SELECT * FROM Users');
        const users = result.map(r => {
            const u = r.Users;
            return { id: u.ROWID, ...u };
        });
        res.json({ success: true, count: users.length, data: users });
    } catch (err) {
        next(err);
    }
});

// POST /invite — Invite a user (provision in Catalyst + create local record)
router.post('/invite', async (req, res, next) => {
    try {
        const { name, email, workspace_id, role_id } = req.body;
        if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

        let catalystUserId;
        try {
            const registered = await req.catalystApp.userManagement().registerUser(
                { platform_type: 'web' },
                { first_name: name || email.split('@')[0], last_name: '-', email_id: email }
            );
            catalystUserId = String(registered.user_id);
        } catch (authErr) {
            return res.status(500).json({ success: false, message: 'Failed to provision user: ' + authErr.message });
        }

        const datastore = getDatastore(req);

        // Get organization_id — mandatory BIGINT column
        let organizationId;
        try {
            const orgResult = await executeZCQL(req, 'SELECT ROWID FROM Organization LIMIT 1');
            organizationId = orgResult.length > 0 ? toBigInt(orgResult[0].Organization.ROWID) : Date.now();
        } catch (e) {
            organizationId = Date.now();
        }

        // Check if user exists locally
        let existing = await executeZCQL(req, `SELECT ROWID FROM Users WHERE email = '${email}'`);
        let userRowId;

        if (existing.length > 0) {
            userRowId = existing[0].Users.ROWID;
            await datastore.table('Users').updateRow({ ROWID: userRowId, catalyst_user_id: catalystUserId });
        } else {
            const row = await datastore.table('Users').insertRow({
                user_id: Date.now(),
                catalyst_user_id: catalystUserId,
                display_name: name || email.split('@')[0],
                email,
                organization_id: organizationId,
                is_super_admin: 'false',
                role_version: 0,
                status: 'active',
                color: '#E0E7FF',
                initials: (name || email).substring(0, 2).toUpperCase(),
                created_at: catalystDateTime(),
            });
            userRowId = row.ROWID;
        }

        // Assign to workspace if provided — all _id columns are BIGINT
        if (workspace_id && role_id) {
            const existingMembership = await executeZCQL(req,
                `SELECT ROWID FROM UserWorkspaces WHERE user_id = '${userRowId}' AND workspace_id = '${workspace_id}'`
            );
            if (existingMembership.length === 0) {
                await datastore.table('UserWorkspaces').insertRow({
                    user_workspace_id: Date.now() + 1,
                    user_id: toBigInt(userRowId),
                    workspace_id: toBigInt(workspace_id),
                    role_id: toBigInt(role_id),
                    status: 'active',
                    joined_at: catalystDateTime(),
                });
            }
        }

        await insertAuditLog(req, { userId: req.user.user_id, action: 'user.invited', resourceType: 'User', resourceId: userRowId, details: { email, workspace_id } });

        res.status(201).json({ success: true, data: { user_id: userRowId, email, catalyst_user_id: catalystUserId } });
    } catch (err) {
        next(err);
    }
});

// POST /:id/assign-workspace — Assign user to a workspace with a role
router.post('/:id/assign-workspace', async (req, res, next) => {
    try {
        const { workspace_id, role_id } = req.body;
        if (!workspace_id || !role_id) {
            return res.status(400).json({ success: false, message: 'workspace_id and role_id required.' });
        }

        const datastore = getDatastore(req);
        const existing = await executeZCQL(req,
            `SELECT ROWID FROM UserWorkspaces WHERE user_id = '${req.params.id}' AND workspace_id = '${workspace_id}'`
        );

        if (existing.length > 0) {
            // Update existing membership role — role_id is BIGINT
            await datastore.table('UserWorkspaces').updateRow({
                ROWID: existing[0].UserWorkspaces.ROWID,
                role_id: toBigInt(role_id),
                status: 'active',
            });
        } else {
            // All _id columns are BIGINT — must be numeric
            await datastore.table('UserWorkspaces').insertRow({
                user_workspace_id: Date.now(),
                user_id: toBigInt(req.params.id),
                workspace_id: toBigInt(workspace_id),
                role_id: toBigInt(role_id),
                status: 'active',
                joined_at: catalystDateTime(),
            });
        }

        res.json({ success: true, message: 'User assigned to workspace.' });
    } catch (err) {
        next(err);
    }
});

// POST /:id/remove-workspace — Remove user from a workspace
router.post('/:id/remove-workspace', async (req, res, next) => {
    try {
        const { workspace_id } = req.body;
        const datastore = getDatastore(req);
        const result = await executeZCQL(req,
            `SELECT ROWID FROM UserWorkspaces WHERE user_id = '${req.params.id}' AND workspace_id = '${workspace_id}'`
        );
        if (result.length > 0) {
            await datastore.table('UserWorkspaces').deleteRow(result[0].UserWorkspaces.ROWID);
        }
        res.json({ success: true, message: 'User removed from workspace.' });
    } catch (err) {
        next(err);
    }
});

// PUT /:id/toggle-super-admin — Toggle super admin status
router.put('/:id/toggle-super-admin', async (req, res, next) => {
    try {
        const userResult = await executeZCQL(req, `SELECT * FROM Users WHERE ROWID = '${req.params.id}'`);
        if (userResult.length === 0) return res.status(404).json({ success: false, message: 'User not found.' });

        const current = userResult[0].Users.is_super_admin;
        const newVal = current === 'true' ? 'false' : 'true';

        const datastore = getDatastore(req);
        await datastore.table('Users').updateRow({ ROWID: req.params.id, is_super_admin: newVal });

        await insertAuditLog(req, { userId: req.user.user_id, action: 'user.super_admin_toggled', resourceType: 'User', resourceId: req.params.id, details: { is_super_admin: newVal } });

        res.json({ success: true, message: `Super admin: ${newVal}` });
    } catch (err) {
        next(err);
    }
});

// PUT /:id — Update user profile (admin-level)
router.put('/:id', async (req, res, next) => {
    try {
        const datastore = getDatastore(req);
        const body = { ...req.body };
        // Remap 'name' → 'display_name' for Catalyst compatibility
        if (body.name && !body.display_name) {
            body.display_name = body.name;
        }
        delete body.name;
        const updateData = { ROWID: req.params.id, ...body };
        const updated = await datastore.table('Users').updateRow(updateData);
        res.json({ success: true, data: updated });
    } catch (err) {
        next(err);
    }
});

// DELETE /:id — Deactivate user
router.delete('/:id', async (req, res, next) => {
    try {
        const datastore = getDatastore(req);
        await datastore.table('Users').updateRow({ ROWID: req.params.id, status: 'deactivated' });
        res.json({ success: true, message: 'User deactivated.' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
