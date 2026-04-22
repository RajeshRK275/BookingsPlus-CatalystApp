/**
 * Permission Middleware — Granular permission guard.
 * 
 * Factory function: requirePermission('services.create') returns a middleware.
 * Checks if the user's role in the active workspace has the required permission
 * via the RolePermissions + Permissions tables.
 * 
 * Super admins and users with role_level >= 99 (Owner) always bypass.
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

            // Check if the role has the required permission
            const result = await executeZCQL(req,
                `SELECT rp.ROWID FROM RolePermissions rp 
                 JOIN Permissions p ON rp.permission_id = p.ROWID 
                 WHERE rp.role_id = '${req.userRole.role_id}' 
                 AND p.permission_key = '${permissionKey}'`
            );

            if (result.length > 0) {
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

            const keyList = permissionKeys.map(k => `'${k}'`).join(',');
            const result = await executeZCQL(req,
                `SELECT rp.ROWID FROM RolePermissions rp 
                 JOIN Permissions p ON rp.permission_id = p.ROWID 
                 WHERE rp.role_id = '${req.userRole.role_id}' 
                 AND p.permission_key IN (${keyList})`
            );

            if (result.length > 0) return next();

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
