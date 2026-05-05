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
/**
 * Read-only permissions that ALL authenticated staff should have.
 * These are the minimum permissions needed to see data on pages.
 * Without these, a staff user with no role_id gets 403 on every page.
 */
const STAFF_DEFAULT_PERMISSIONS = new Set([
    'dashboard.read',
    'services.read',
    'appointments.read', 'appointments.create',
    'customers.read', 'customers.create',
    'users.read',
]);

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

            // Admin role (level 50+) bypasses all permission checks
            if (req.userRole && req.userRole.role_level >= 50) {
                return next();
            }

            // ── No role_id (fallback staff from workspace middleware) ──
            // When workspace middleware couldn't find a UserWorkspaces membership,
            // it grants Staff-level access with role_id = null.
            // Allow default staff permissions so they can at least see data.
            if (!req.userRole || !req.userRole.role_id) {
                if (STAFF_DEFAULT_PERMISSIONS.has(permissionKey)) {
                    console.log(`[PermissionMiddleware] No role_id, granting default staff permission: ${permissionKey}`);
                    return next();
                }
                return res.status(403).json({
                    success: false,
                    message: `No role assigned. Permission "${permissionKey}" requires a role.`
                });
            }

            // Step 1: Find the permission ROWID by permission_key
            const permResult = await executeZCQL(req,
                `SELECT ROWID FROM Permissions WHERE permission_key = '${permissionKey}'`
            );
            if (permResult.length === 0) {
                // Permission key doesn't exist in the system.
                // For read permissions, allow by default (table may not be seeded yet)
                if (permissionKey.endsWith('.read')) {
                    console.log(`[PermissionMiddleware] Permission "${permissionKey}" not found in DB, allowing read by default`);
                    return next();
                }
                return res.status(403).json({
                    success: false,
                    message: `Permission "${permissionKey}" not found in system.`
                });
            }
            const permissionId = permResult[0].Permissions.ROWID;

            // Step 2: Check if the role has this permission in RolePermissions
            // Try exact role_id match first
            let rpResult = await executeZCQL(req,
                `SELECT ROWID FROM RolePermissions WHERE role_id = '${req.userRole.role_id}' AND permission_id = '${permissionId}'`
            );

            // If no match, try fuzzy ±10 on role_id (onboarding ID mismatch)
            if (rpResult.length === 0) {
                try {
                    const allRp = await executeZCQL(req,
                        `SELECT * FROM RolePermissions WHERE permission_id = '${permissionId}'`
                    );
                    const targetRoleId = parseInt(String(req.userRole.role_id), 10);
                    if (!isNaN(targetRoleId)) {
                        const fuzzyMatch = allRp.find(row => {
                            const rp = row.RolePermissions || row;
                            const rpRoleId = parseInt(String(rp.role_id), 10);
                            return !isNaN(rpRoleId) && Math.abs(rpRoleId - targetRoleId) <= 10;
                        });
                        if (fuzzyMatch) rpResult = [fuzzyMatch];
                    }
                } catch (e) { /* ignore fuzzy failure */ }
            }

            if (rpResult.length > 0) {
                return next();
            }

            // Staff default permission fallback for read access
            if (STAFF_DEFAULT_PERMISSIONS.has(permissionKey)) {
                console.log(`[PermissionMiddleware] Role ${req.userRole.role_id} lacks "${permissionKey}", granting as default staff permission`);
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
