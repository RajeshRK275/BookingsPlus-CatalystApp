const express = require('express');
const router = express.Router();
const { getDatastore, executeZCQL, insertAuditLog } = require('../../utils/datastore');

// All routes guarded by superAdminGuard in index.js

/** Coerce any value to a safe BIGINT-compatible number for Catalyst Data Store */
const toBigInt = (value) => {
    if (value === null || value === undefined) return Date.now();
    if (typeof value === 'number' && !isNaN(value)) return value;
    const parsed = parseInt(String(value), 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
    return Date.now();
};

// GET /:wsId/roles — List all roles for a workspace
router.get('/:wsId/roles', async (req, res, next) => {
    try {
        const result = await executeZCQL(req,
            `SELECT * FROM Roles WHERE workspace_id = '${req.params.wsId}'`
        );
        const roles = result.map(r => ({ id: r.Roles.ROWID, ...r.Roles }));
        res.json({ success: true, data: roles });
    } catch (err) {
        next(err);
    }
});

// POST /:wsId/roles — Create a new role for a workspace
router.post('/:wsId/roles', async (req, res, next) => {
    try {
        const { role_name, role_level, description, permission_ids } = req.body;
        if (!role_name) return res.status(400).json({ success: false, message: 'role_name required.' });

        const datastore = getDatastore(req);
        // workspace_id is BIGINT — must be numeric
        const roleRow = await datastore.table('Roles').insertRow({
            role_id: Date.now(),
            workspace_id: toBigInt(req.params.wsId),
            role_name,
            role_level: parseInt(role_level) || 0,
            is_system: 'false',
            description: description || '',
        });

        // Assign permissions if provided — all _id columns are BIGINT
        if (Array.isArray(permission_ids)) {
            const baseTs = Date.now();
            for (let i = 0; i < permission_ids.length; i++) {
                await datastore.table('RolePermissions').insertRow({
                    role_perm_id: baseTs + i + 1,
                    role_id: toBigInt(roleRow.ROWID),
                    permission_id: toBigInt(permission_ids[i]),
                });
            }
        }

        await insertAuditLog(req, { userId: req.user.user_id, action: 'role.created', resourceType: 'Role', resourceId: roleRow.ROWID, details: { role_name, workspace_id: req.params.wsId } });

        res.status(201).json({ success: true, data: roleRow });
    } catch (err) {
        next(err);
    }
});

// PUT /roles/:roleId — Update a role
router.put('/roles/:roleId', async (req, res, next) => {
    try {
        // Check if system role
        const existing = await executeZCQL(req, `SELECT * FROM Roles WHERE ROWID = '${req.params.roleId}'`);
        if (existing.length === 0) return res.status(404).json({ success: false, message: 'Role not found.' });
        if (existing[0].Roles.is_system === 'true' && req.body.role_name) {
            return res.status(403).json({ success: false, message: 'Cannot rename system roles.' });
        }

        const datastore = getDatastore(req);
        const updateData = { ROWID: req.params.roleId, ...req.body };
        delete updateData.is_system;
        delete updateData.workspace_id;

        const updated = await datastore.table('Roles').updateRow(updateData);
        res.json({ success: true, data: updated });
    } catch (err) {
        next(err);
    }
});

// DELETE /roles/:roleId — Delete a non-system role
router.delete('/roles/:roleId', async (req, res, next) => {
    try {
        const existing = await executeZCQL(req, `SELECT * FROM Roles WHERE ROWID = '${req.params.roleId}'`);
        if (existing.length === 0) return res.status(404).json({ success: false, message: 'Role not found.' });
        if (existing[0].Roles.is_system === 'true') {
            return res.status(403).json({ success: false, message: 'Cannot delete system roles.' });
        }

        const datastore = getDatastore(req);
        // Delete role-permission mappings first
        const rpResult = await executeZCQL(req, `SELECT ROWID FROM RolePermissions WHERE role_id = '${req.params.roleId}'`);
        for (const rp of rpResult) {
            await datastore.table('RolePermissions').deleteRow(rp.RolePermissions.ROWID);
        }
        await datastore.table('Roles').deleteRow(req.params.roleId);

        res.json({ success: true, message: 'Role deleted.' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
