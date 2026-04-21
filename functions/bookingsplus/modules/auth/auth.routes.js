const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/auth.middleware');
const { executeZCQL } = require('../../utils/datastore');

// Native GET /me to read standard Catalyst Cookie User context
router.get('/me', authMiddleware, async (req, res, next) => {
    try {
        const userId = req.user.user_id; // from Catalyst

        // Look up the user inside our Datastore
        const query = `SELECT tenant_id, role FROM Users WHERE user_id = '${userId}'`;
        const result = await executeZCQL(req, query);

        if (result && result.length > 0) {
            // User physically mapped in Datastore
            const mappedParams = result[0].Users;
            req.user.tenant_id = mappedParams.tenant_id;
            req.user.role = mappedParams.role;
            
            return res.json({ 
                success: true, 
                needsOnboarding: false,
                user: req.user
            });
        }

        // New Catalyst user missing Datastore tenant
        res.json({ 
            success: true,
            needsOnboarding: true,
            user: req.user
        });
    } catch (err) {
        // ZCQL throws error if table doesn't exist, we fallback to needsOnboarding for fresh DBs
        console.warn("User datastore map missing/schema empty", err);
        res.json({ 
            success: true,
            needsOnboarding: true,
            user: req.user
        });
    }
});

module.exports = router;
