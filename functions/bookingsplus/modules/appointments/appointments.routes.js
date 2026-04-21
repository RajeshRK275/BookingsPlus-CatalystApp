const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/auth.middleware');
const tenantMiddleware = require('../../middleware/tenant.middleware');
const { getDatastore, executeZCQL } = require('../../utils/datastore');

router.use(authMiddleware);
router.use(tenantMiddleware);

// Retrieve appointments scoped to Tenant
router.get('/', async (req, res, next) => {
    try {
        const { date, status } = req.query;
        let query = `SELECT * FROM Appointments WHERE tenant_id = '${req.tenantId}'`;

        if (status) {
            query += ` AND appointment_status = '${status}'`;
        }
        
        const result = await executeZCQL(req, query);
        const appointments = result.map(row => {
            const apt = row.Appointments;
            return {
                id: apt.appointment_id || apt.ROWID,
                ...apt
            };
        });
        res.json({ success: true, count: appointments.length, data: appointments });
    } catch (err) {
        next(err);
    }
});

// Request an appointment
router.post('/book', async (req, res, next) => {
    try {
        const { service_id, service_name, staff_id, staff_name, customer_id, customer_name, start_time, end_time, notes } = req.body;
        
        const appointment_id = Date.now().toString(); 
        const datastore = getDatastore(req);
        
        const recordData = {
            appointment_id,
            tenant_id: req.tenantId,
            organization_id: req.user.organization_id,
            service_id: service_id || '',
            service_name: service_name || '',
            staff_id: staff_id || '',
            staff_name: staff_name || '',
            customer_id: customer_id || '',
            customer_name: customer_name || '',
            appointment_status: 'pending',
            start_time: start_time || '',
            end_time: end_time || '',
            notes: notes || '',
            payment_status: 'unpaid',
            approval_status: 'awaiting_approval' 
        };
        
        const row = await datastore.table('Appointments').insertRow(recordData);
        res.status(201).json({ success: true, data: row });
    } catch(err) {
         next(err);
    }
});

// Update appointment
router.put('/:id', async (req, res, next) => {
    try {
        const appointmentId = req.params.id;
        const datastore = getDatastore(req);
        
        const query = `SELECT ROWID FROM Appointments WHERE tenant_id = '${req.tenantId}' AND appointment_id = '${appointmentId}'`;
        const existing = await executeZCQL(req, query);
        if (!existing || existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Appointment not found' });
        }
        
        const updateData = {
            ROWID: existing[0].Appointments.ROWID,
            ...req.body
        };
        
        const updatedRow = await datastore.table('Appointments').updateRow(updateData);
        res.json({ success: true, data: updatedRow });
    } catch (err) {
        next(err);
    }
});

// Delete appointment
router.delete('/:id', async (req, res, next) => {
    try {
        const appointmentId = req.params.id;
        const datastore = getDatastore(req);
        
        const query = `SELECT ROWID FROM Appointments WHERE tenant_id = '${req.tenantId}' AND appointment_id = '${appointmentId}'`;
        const existing = await executeZCQL(req, query);
        if (!existing || existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Appointment not found' });
        }
        
        await datastore.table('Appointments').deleteRow(existing[0].Appointments.ROWID);
        res.json({ success: true, message: 'Appointment deleted successfully' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
