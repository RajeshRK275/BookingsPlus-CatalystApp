const express = require('express');
const router = express.Router();
const webhookAuth = require('../../middleware/webhook.middleware');
const { getDatastore, executeZCQL, insertAuditLog } = require('../../utils/datastore');

/**
 * POST /role-sync — Admin App Webhook → Catalyst Role Sync
 * 
 * When the admin app changes a user's role, it fires this webhook.
 * This endpoint:
 *   1. Updates the UserRoleMapping table (source of truth)
 *   2. Calls the Catalyst User Management API to update the live role
 *   3. Increments role_version for session invalidation
 * 
 * Protected by X-Admin-Secret header.
 */
router.post('/role-sync', webhookAuth, async (req, res, next) => {
    try {
        const { user_email, catalyst_role_id, subscription_type, assigned_by } = req.body;

        if (!user_email || !catalyst_role_id) {
            return res.status(400).json({
                success: false,
                message: 'user_email and catalyst_role_id are required.'
            });
        }

        const datastore = getDatastore(req);

        // 1. Find the user
        const userResult = await executeZCQL(req, `SELECT * FROM Users WHERE email = '${user_email}'`);
        if (userResult.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        const user = userResult[0].Users;
        const currentVersion = parseInt(user.role_version) || 0;
        const newVersion = currentVersion + 1;

        // 2. Update or create UserRoleMapping (source of truth)
        const existingMapping = await executeZCQL(req,
            `SELECT ROWID FROM UserRoleMapping WHERE user_email = '${user_email}'`
        );

        if (existingMapping.length > 0) {
            await datastore.table('UserRoleMapping').updateRow({
                ROWID: existingMapping[0].UserRoleMapping.ROWID,
                catalyst_role_id,
                subscription_type: subscription_type || '',
                assigned_by: assigned_by || 'admin',
                role_version: newVersion,
                updated_at: new Date().toISOString(),
            });
        } else {
            await datastore.table('UserRoleMapping').insertRow({
                mapping_id: Date.now(),
                user_email,
                catalyst_user_id: user.catalyst_user_id || '',
                catalyst_role_id,
                subscription_type: subscription_type || '',
                assigned_by: assigned_by || 'admin',
                role_version: newVersion,
                updated_at: new Date().toISOString(),
            });
        }

        // 3. Update the Users table with new role_version
        await datastore.table('Users').updateRow({
            ROWID: user.ROWID,
            catalyst_role_id,
            role_version: newVersion,
        });

        // 4. Call Catalyst User Management API to update the live role
        if (user.catalyst_user_id) {
            try {
                await req.catalystApp.userManagement().updateUser(user.catalyst_user_id, {
                    role_id: catalyst_role_id
                });
                console.log(`Catalyst role updated for user ${user_email} → role ${catalyst_role_id}`);
            } catch (catalystErr) {
                console.error('Failed to update Catalyst role:', catalystErr.message);
                // Don't fail the request — the mapping is already updated
                // Role will sync on next login via session invalidation
            }
        }

        // 5. Audit log
        await insertAuditLog(req, {
            userId: assigned_by || 'admin-webhook',
            action: 'user.role_synced',
            resourceType: 'User',
            resourceId: user.ROWID,
            details: { user_email, catalyst_role_id, role_version: newVersion, subscription_type },
        });

        res.json({
            success: true,
            message: `Role synced for ${user_email}. Version: ${newVersion}. Takes effect on next request.`,
            data: { user_email, catalyst_role_id, role_version: newVersion }
        });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /role-mapping — Get all role mappings (for admin dashboard)
 */
router.get('/role-mapping', webhookAuth, async (req, res, next) => {
    try {
        const result = await executeZCQL(req, 'SELECT * FROM UserRoleMapping');
        const mappings = result.map(r => ({ id: r.UserRoleMapping.ROWID, ...r.UserRoleMapping }));
        res.json({ success: true, data: mappings });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
