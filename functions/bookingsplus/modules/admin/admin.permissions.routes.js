const express = require('express');
const router = express.Router();
const { getDatastore, executeZCQL } = require('../../utils/datastore');

// All routes guarded by superAdminGuard in index.js

// GET / — List all permission definitions
router.get('/', async (req, res, next) => {
    try {
        const result = await executeZCQL(req, 'SELECT * FROM Permissions');
        const permissions = result.map(r => ({ id: r.Permissions.ROWID, ...r.Permissions }));
        res.json({ success: true, data: permissions });
    } catch (err) {
        next(err);
    }
});

// GET /role/:roleId — Get permissions assigned to a role
router.get('/role/:roleId', async (req, res, next) => {
    try {
        const result = await executeZCQL(req,
            `SELECT rp.ROWID as rp_id, p.permission_key, p.resource, p.action, p.description 
             FROM RolePermissions rp 
             JOIN Permissions p ON rp.permission_id = p.ROWID 
             WHERE rp.role_id = '${req.params.roleId}'`
        );
        const permissions = result.map(r => ({
            rp_id: (r.RolePermissions || r).rp_id,
            permission_key: (r.Permissions || r).permission_key,
            resource: (r.Permissions || r).resource,
            action: (r.Permissions || r).action,
            description: (r.Permissions || r).description,
        }));
        res.json({ success: true, data: permissions });
    } catch (err) {
        next(err);
    }
});

// POST /roles/:roleId/assign — Assign permission(s) to a role
router.post('/roles/:roleId/assign', async (req, res, next) => {
    try {
        const { permission_ids } = req.body;
        if (!Array.isArray(permission_ids)) {
            return res.status(400).json({ success: false, message: 'permission_ids array required.' });
        }

        const datastore = getDatastore(req);
        let added = 0;

        for (const permId of permission_ids) {
            // Check if already assigned
            const existing = await executeZCQL(req,
                `SELECT ROWID FROM RolePermissions WHERE role_id = '${req.params.roleId}' AND permission_id = '${permId}'`
            );
            if (existing.length === 0) {
                await datastore.table('RolePermissions').insertRow({
                    role_perm_id: Date.now() + added,
                    role_id: req.params.roleId,
                    permission_id: permId,
                });
                added++;
            }
        }

        res.json({ success: true, message: `${added} permission(s) assigned.` });
    } catch (err) {
        next(err);
    }
});

// DELETE /roles/:roleId/revoke/:permId — Revoke a permission from a role
router.delete('/roles/:roleId/revoke/:permId', async (req, res, next) => {
    try {
        const result = await executeZCQL(req,
            `SELECT ROWID FROM RolePermissions WHERE role_id = '${req.params.roleId}' AND permission_id = '${req.params.permId}'`
        );
        if (result.length === 0) {
            return res.status(404).json({ success: false, message: 'Permission assignment not found.' });
        }

        const datastore = getDatastore(req);
        await datastore.table('RolePermissions').deleteRow(result[0].RolePermissions.ROWID);

        res.json({ success: true, message: 'Permission revoked.' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
