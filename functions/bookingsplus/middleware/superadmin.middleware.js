/**
 * Super Admin Middleware — Guards all /api/v1/admin/* routes.
 * Only users with is_super_admin === true can access admin endpoints.
 */
const superAdminGuard = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required.'
        });
    }

    if (!req.user.is_super_admin) {
        return res.status(403).json({
            success: false,
            message: 'Super Admin access required.'
        });
    }

    next();
};

module.exports = superAdminGuard;
