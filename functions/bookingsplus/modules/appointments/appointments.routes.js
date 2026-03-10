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
        // Strict tenant isolation via ZCQL
        const { date, status } = req.query;
        let query = `SELECT * FROM Appointments WHERE tenant_id = '${req.tenantId}'`;

        if (status) {
            query += ` AND appointment_status = '${status}'`;
        }
        
        // ZCQL has limited datetime range queries, typically we fetch and filter or use strict equality
        
        const result = await executeZCQL(req, query);
        const appointments = result.map(row => row.Appointments);
        res.json({ success: true, count: appointments.length, data: appointments });
    } catch (err) {
        next(err);
    }
});

// Request an appointment (Customer / Public booking)
// Note: In reality public booking might skip token auth but requires org identifying key. 
// For this SaaS admin interface we assume logged-in staff creating it on behalf of customer.
router.post('/book', async (req, res, next) => {
    try {
        const { service_id, staff_id, customer_id, start_time, end_time, notes } = req.body;
        
        const appointment_id = Date.now(); 
        const datastore = getDatastore(req);
        
        const recordData = {
            appointment_id,
            tenant_id: req.tenantId,
            organization_id: req.user.organization_id,
            service_id,
            staff_id,
            customer_id,
            appointment_status: 'pending',
            start_time,
            end_time,
            notes: notes || '',
            payment_status: 'unpaid',
            // Enterprise feature: Bookings go into awaiting_approval state for Manager review
            approval_status: 'awaiting_approval' 
        };
        
        const rowPromise = datastore.table('Appointments').insertRow(recordData);
        await rowPromise;

        // In a real Catalyst Event architecture, triggering the 'appointment_created' event would be dispatched here
        // or automatically picked up by Event Triggers listening on Data Store row inserts.

        res.status(201).json({ success: true, data: recordData });
    } catch(err) {
         next(err);
    }
});

module.exports = router;
