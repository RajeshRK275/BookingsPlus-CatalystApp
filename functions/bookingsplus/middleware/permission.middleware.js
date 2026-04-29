/**
 * Permission Middleware — Granular permission guard.
 * 
 * Factory function: requirePermission('services.create') returns a middleware.
 * Checks if the user's role in the active workspace has the required permission
 * via the RolePermissions + Permissions tables.
 * 
 * Super admins and users with role_level >= 99 (Owner) always bypass.
 * 
 * IMPORTANT: Uses SEPARATE queries instead of JOINs to avoid the Catalyst ZCQL
 * "No relationship between tables" error.
 */
const { executeZCQL } = require('../utils/datastore');

/**
 * Creates middleware that checks for a specific permission.
 * @param {string} permissionKey - e.g., 'services.create', 'appointments.delete'
 * @returns {Function} Express middleware
 */
const requirePermission = (permissionKey) => {
    return async (req, res, next) => {
        try {
            // Super admins bypass all permission checks
            if (req.user && req.user.is_super_admin) {
                return next();
            }

            // Owner role (level 99+) bypasses all permission checks
            if (req.userRole && req.userRole.role_level >= 99) {
                return next();
            }

            if (!req.userRole || !req.userRole.role_id) {
                return res.status(403).json({
                    success: false,
                    message: 'No role assigned in this workspace.'
                });
            }

            // Step 1: Find the permission ROWID by permission_key
            const permResult = await executeZCQL(req,
                `SELECT ROWID FROM Permissions WHERE permission_key = '${permissionKey}'`
            );
            if (permResult.length === 0) {
                // Permission key doesn't exist in the system — deny
                return res.status(403).json({
                    success: false,
                    message: `Permission "${permissionKey}" not found in system.`
                });
            }
            const permissionId = permResult[0].Permissions.ROWID;

            // Step 2: Check if the role has this permission in RolePermissions
            const rpResult = await executeZCQL(req,
                `SELECT ROWID FROM RolePermissions WHERE role_id = '${req.userRole.role_id}' AND permission_id = '${permissionId}'`
            );

            if (rpResult.length > 0) {
                return next();
            }

            return res.status(403).json({
                success: false,
                message: `Insufficient permissions. Required: ${permissionKey}`
            });
        } catch (err) {
            console.error('Permission check error:', err);
            return res.status(500).json({
                success: false,
                message: 'Permission check error: ' + err.message
            });
        }
    };
};

/**
 * Creates middleware that checks for ANY of the given permissions.
 * @param {string[]} permissionKeys - Array of permission keys
 * @returns {Function} Express middleware
 */
const requireAnyPermission = (permissionKeys) => {
    return async (req, res, next) => {
        try {
            if (req.user && req.user.is_super_admin) return next();
            if (req.userRole && req.userRole.role_level >= 99) return next();

            if (!req.userRole || !req.userRole.role_id) {
                return res.status(403).json({ success: false, message: 'No role assigned.' });
            }

            // Step 1: Find permission ROWIDs for all the requested permission keys
            const keyList = permissionKeys.map(k => `'${k}'`).join(',');
            const permResult = await executeZCQL(req,
                `SELECT ROWID FROM Permissions WHERE permission_key IN (${keyList})`
            );

            if (permResult.length === 0) {
                return res.status(403).json({
                    success: false,
                    message: `No matching permissions found. Required one of: ${permissionKeys.join(', ')}`
                });
            }

            // Step 2: Check if the role has ANY of these permissions
            const permIdList = permResult.map(r => `'${r.Permissions.ROWID}'`).join(',');
            const rpResult = await executeZCQL(req,
                `SELECT ROWID FROM RolePermissions WHERE role_id = '${req.userRole.role_id}' AND permission_id IN (${permIdList})`
            );

            if (rpResult.length > 0) return next();

            return res.status(403).json({
                success: false,
                message: `Insufficient permissions. Required one of: ${permissionKeys.join(', ')}`
            });
        } catch (err) {
            console.error('Permission check error:', err);
            return res.status(500).json({ success: false, message: 'Permission check error: ' + err.message });
        }
    };
};

module.exports = { requirePermission, requireAnyPermission };
