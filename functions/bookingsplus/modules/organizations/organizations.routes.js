const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/auth.middleware');
const tenantMiddleware = require('../../middleware/tenant.middleware');
const { getDatastore, executeZCQL } = require('../../utils/datastore');

router.use(authMiddleware);

// Setup new Organization for Datastore onboarding
router.post('/setup', async (req, res, next) => {
    try {
        const { organization_name } = req.body;
        if (!organization_name) return res.status(400).json({ success: false, message: 'Organization name required.' });

        const datastore = getDatastore(req);
        
        // 1. Generate new tenant_id
        const tenant_id = `T-${Date.now()}`;
        
        // 2. Insert into Organizations
        const orgData = {
            tenant_id,
            name: organization_name,
            created_by: req.user.user_id,
            created_at: new Date().toISOString()
        };
        await datastore.table('Organizations').insertRow(orgData);

        // 3. Insert into Users mapping
        const userData = {
            user_id: req.user.user_id,
            tenant_id,
            name: `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || req.user.email_id.split('@')[0],
            email: req.user.email_id,
            role: 'Admin',
            status: 'Active',
            color: '#E0E7FF'
        };
        await datastore.table('Users').insertRow(userData);

        res.json({ success: true, message: 'Organization provisioned securely', tenant_id });
    } catch (err) {
        next(err);
    }
});

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
