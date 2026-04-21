const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/auth.middleware');
const tenantMiddleware = require('../../middleware/tenant.middleware');
const rbacMiddleware = require('../../middleware/rbac.middleware');
const { getDatastore, executeZCQL } = require('../../utils/datastore');

router.use(authMiddleware);
router.use(tenantMiddleware);

// Get all services
router.get('/', async (req, res, next) => {
    try {
        const query = `SELECT * FROM Services WHERE tenant_id = '${req.tenantId}'`;
        const result = await executeZCQL(req, query);
        const services = result.map(row => {
            const svc = row.Services;
            return {
                id: svc.service_id || svc.ROWID,
                ...svc
            };
        });
        res.json({ success: true, count: services.length, data: services });
    } catch (err) {
        next(err);
    }
});

// Create service
router.post('/', rbacMiddleware(['Admin', 'Manager']), async (req, res, next) => {
    try {
        const { name, description, duration_minutes, duration, price, service_type, type, meeting_mode, meeting_location, seats, staff_ids } = req.body;
        
        if (!name) {
             return res.status(400).json({ success: false, message: 'Name is required' });
        }
        
        const service_id = Date.now().toString(); 
        const datastore = getDatastore(req);
        const table = datastore.table('Services');
        
        const recordData = {
            service_id,
            tenant_id: req.tenantId,
            organization_id: req.user.organization_id, 
            name,
            description: description || '',
            duration_minutes: parseInt(duration_minutes || duration, 10) || 60,
            price: parseFloat(price) || 0.0,
            service_type: service_type || type || 'one-on-one',
            meeting_mode: meeting_mode || 'Online',
            meeting_location: meeting_location || '',
            seats: parseInt(seats, 10) || 1,
            status: 'active'
        };
        
        const row = await table.insertRow(recordData);

        if (Array.isArray(staff_ids) && staff_ids.length > 0) {
            const staffTable = datastore.table('ServiceStaff');
            const staffPromises = staff_ids.map(staffId =>
                staffTable.insertRow({
                    service_id,
                    staff_id: staffId.toString(),
                    tenant_id: req.tenantId
                })
            );
            await Promise.all(staffPromises);
        }
        
        res.status(201).json({ success: true, data: row });
    } catch (err) {
        next(err);
    }
});

// Update service
router.put('/:id', rbacMiddleware(['Admin', 'Manager']), async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const datastore = getDatastore(req);
        
        const query = `SELECT ROWID FROM Services WHERE tenant_id = '${req.tenantId}' AND service_id = '${serviceId}'`;
        const existing = await executeZCQL(req, query);
        if (!existing || existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Service not found' });
        }
        
        const updateData = {
            ROWID: existing[0].Services.ROWID,
            ...req.body
        };
        
        const updatedRow = await datastore.table('Services').updateRow(updateData);
        res.json({ success: true, data: updatedRow });
    } catch (err) {
        next(err);
    }
});

// Delete service
router.delete('/:id', rbacMiddleware(['Admin', 'Manager']), async (req, res, next) => {
    try {
        const serviceId = req.params.id;
        const datastore = getDatastore(req);
        
        const query = `SELECT ROWID FROM Services WHERE tenant_id = '${req.tenantId}' AND service_id = '${serviceId}'`;
        const existing = await executeZCQL(req, query);
        if (!existing || existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Service not found' });
        }
        
        await datastore.table('Services').deleteRow(existing[0].Services.ROWID);
        res.json({ success: true, message: 'Service deleted successfully' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
