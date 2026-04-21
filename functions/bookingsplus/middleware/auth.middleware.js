const { executeZCQL } = require('../utils/datastore');

const authMiddleware = async (req, res, next) => {
    try {
        if (!req.catalystApp) {
            return res.status(500).json({ success: false, message: 'Catalyst App not initialized.' });
        }
        
        const userManagement = req.catalystApp.userManagement();
        const userPromise = userManagement.getCurrentProjectUser();
        const user = await userPromise;

        if (!user) {
            return res.status(401).json({ success: false, message: 'Authentication required.' });
        }

        // Map Catalyst user parameters natively
        req.user = {
            user_id: user.user_id,
            email_id: user.email_id,
            first_name: user.first_name,
            last_name: user.last_name,
            role_details: user.role_details
        };

        // Hydrate req.user with Datastore properties (tenant_id, local role)
        // Note: During initial signup / setup, this may be empty.
        try {
            const query = `SELECT tenant_id, role, ROWID, organization_id FROM Users WHERE user_id = '${req.user.user_id}'`;
            const mappedUser = await executeZCQL(req, query);
            
            if (mappedUser && mappedUser.length > 0) {
                const u = mappedUser[0].Users;
                req.user.tenant_id = u.tenant_id;
                req.user.role = u.role;
                req.user.organization_id = u.organization_id; // Will help with nested mappings downstream
            }
        } catch (dbErr) {
            // Log but don't fail, let /me handle Onboarding loop if schema missing
            console.warn("Auth Middleware: Failed to lookup datastore mapped user. ", dbErr.message || dbErr);
        }
        
        next();
    } catch (err) {
        console.error('Auth Middleware Error:', err);
        return res.status(401).json({ success: false, message: 'Invalid or expired session.' });
    }
};

module.exports = authMiddleware;
