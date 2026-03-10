const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/auth.middleware');
const tenantMiddleware = require('../../middleware/tenant.middleware');
const { getDatastore, executeZCQL } = require('../../utils/datastore');

router.use(authMiddleware);
router.use(tenantMiddleware);

// Get current organization details
router.get('/', async (req, res, next) => {
    try {
        const query = `SELECT * FROM Organizations WHERE tenant_id = '${req.tenantId}'`;
        const result = await executeZCQL(req, query);
        
        if (result.length === 0) {
            return res.status(404).json({ success: false, message: 'Organization not found' });
        }
        
        const orgInfo = result[0].Organizations;
        res.json({ success: true, data: orgInfo });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
