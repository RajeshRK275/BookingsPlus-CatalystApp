const express = require('express');
const router = express.Router();
const { getDatastore, executeZCQL } = require('../../utils/datastore');

// All routes guarded by superAdminGuard in index.js

/** Coerce any value to a safe BIGINT-compatible number for Catalyst Data Store */
const toBigInt = (value) => {
    if (value === null || value === undefined) return Date.now();
    if (typeof value === 'number' && !isNaN(value)) return value;
    const parsed = parseInt(String(value), 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
    return Date.now();
};

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
// Uses SEPARATE queries instead of JOINs to avoid "No relationship between tables" error
router.get('/role/:roleId', async (req, res, next) => {
    try {
        // Step 1: Get all role-permission mappings for this role
        const rpResult = await executeZCQL(req,
            `SELECT * FROM RolePermissions WHERE role_id = '${req.params.roleId}'`
        );

        // Step 2: For each mapping, fetch permission details
        const permissions = [];
        for (const row of rpResult) {
            const rp = row.RolePermissions || row;
            const permId = rp.permission_id;
            if (!permId) continue;

            try {
                const permResult = await executeZCQL(req,
                    `SELECT * FROM Permissions WHERE ROWID = '${permId}'`
                );
                if (permResult.length > 0) {
                    const perm = permResult[0].Permissions || permResult[0];
                    permissions.push({
                        rp_id: rp.ROWID,
                        permission_key: perm.permission_key,
                        resource: perm.resource,
                        action: perm.action,
                        description: perm.description,
                    });
                }
            } catch (e) {
                console.warn(`Failed to fetch permission ${permId}:`, e.message);
            }
        }

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

        const baseTs = Date.now();
        for (const permId of permission_ids) {
            // Check if already assigned
            const existing = await executeZCQL(req,
                `SELECT ROWID FROM RolePermissions WHERE role_id = '${req.params.roleId}' AND permission_id = '${permId}'`
            );
            if (existing.length === 0) {
                // All _id columns are BIGINT — must be numeric
                await datastore.table('RolePermissions').insertRow({
                    role_perm_id: baseTs + added + 1,
                    role_id: toBigInt(req.params.roleId),
                    permission_id: toBigInt(permId),
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
