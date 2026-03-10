const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/auth.middleware');
const tenantMiddleware = require('../../middleware/tenant.middleware');
const rbacMiddleware = require('../../middleware/rbac.middleware');
const { getDatastore, executeZCQL } = require('../../utils/datastore');

router.use(authMiddleware);
router.use(tenantMiddleware);

// Get all services for a specific tenant
router.get('/', async (req, res, next) => {
    try {
        const query = `SELECT * FROM Services WHERE tenant_id = '${req.tenantId}'`;
        const result = await executeZCQL(req, query);
        const services = result.map(row => row.Services);
        res.json({ success: true, count: services.length, data: services });
    } catch (err) {
        next(err);
    }
});

// Admin/Manager only: Create a new service
router.post('/', rbacMiddleware(['Admin', 'Manager']), async (req, res, next) => {
    try {
        const { name, description, duration_minutes, price } = req.body;
        
        if (!name || !duration_minutes) {
             return res.status(400).json({ success: false, message: 'Name and duration_minutes are required' });
        }
        
        const service_id = Date.now(); // Mocking Snowflake ID generation
        const datastore = getDatastore(req);
        const table = datastore.table('Services');
        
        const recordData = {
            service_id,
            tenant_id: req.tenantId,
            organization_id: req.user.organization_id, // Attached from JWT
            name,
            description: description || '',
            duration_minutes: parseInt(duration_minutes, 10),
            price: parseFloat(price) || 0.0,
            status: 'active'
        };
        
        const rowPromise = table.insertRow(recordData);
        const row = await rowPromise;
        
        res.status(201).json({ success: true, data: row });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
