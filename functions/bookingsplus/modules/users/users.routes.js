const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/auth.middleware');
const tenantMiddleware = require('../../middleware/tenant.middleware');
const { getDatastore, executeZCQL } = require('../../utils/datastore');

router.use(authMiddleware);
router.use(tenantMiddleware);

// Get all staff/users for the organization
router.get('/', async (req, res, next) => {
    try {
        const tenantId = req.tenantId;
        // Strict tenant isolation via ZCQL WHERE clause
        const query = `SELECT * FROM Users WHERE tenant_id = '${tenantId}'`;
        const result = await executeZCQL(req, query);
        
        // Map Catalyst Datastore response format
        const users = result.map(row => row.Users);
        
        // Remove password hashes from response
        const sanitizedUsers = users.map(u => {
            const { password_hash, ...safeUser } = u;
            return safeUser;
        });

        res.json({ success: true, count: sanitizedUsers.length, data: sanitizedUsers });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
