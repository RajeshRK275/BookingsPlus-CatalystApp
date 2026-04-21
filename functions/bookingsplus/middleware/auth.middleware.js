/**
 * Auth middleware — currently a pass-through stub.
 * Authentication is disabled while we focus on features.
 * Will be re-implemented later with Catalyst embedded auth.
 */
const authMiddleware = async (req, res, next) => {
    // Attach a mock dev user to every request
    req.user = {
        user_id: 'dev-user-1',
        email_id: 'admin@bookingsplus.dev',
        first_name: 'Admin',
        last_name: 'User',
        role: 'Admin',
        tenant_id: 'dev-tenant-1',
        organization_id: 'dev-org-1',
        auth_type: 'dev',
    };
    next();
};

module.exports = authMiddleware;
