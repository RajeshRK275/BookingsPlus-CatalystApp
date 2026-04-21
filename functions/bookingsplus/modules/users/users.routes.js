const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/auth.middleware');
const tenantMiddleware = require('../../middleware/tenant.middleware');
const { getDatastore, executeZCQL } = require('../../utils/datastore');

router.use(authMiddleware);
router.use(tenantMiddleware);

// GET: Get all staff/users for the organization
router.get('/', async (req, res, next) => {
    try {
        const tenantId = req.tenantId;
        const query = `SELECT * FROM Users WHERE tenant_id = '${tenantId}'`;
        const result = await executeZCQL(req, query);
        
        const users = result.map(row => row.Users);
        
        const sanitizedUsers = users.map(u => {
            const { password_hash, ROWID, CREATORID, CREATEDTIME, MODIFIEDTIME, ...safeUser } = u;
            // Map the ROWID or user_id properly if needed, but Catalyst uses ROWID or custom IDs
            return {
                id: safeUser.user_id || ROWID,
                ...safeUser
            };
        });

        res.json({ success: true, count: sanitizedUsers.length, data: sanitizedUsers });
    } catch (err) {
        next(err);
    }
});

// POST: Create a new employee/user
router.post('/', async (req, res, next) => {
    try {
        const { name, email, role, phone, designation, gender, dob, status, color, initials } = req.body;
        
        let catalystUserId;
        try {
            // 1. Provision the user in Catalyst Authentication (Identity)
            const signupConfig = { platform_type: 'web' };
            const userConfig = {
                first_name: name || email.split('@')[0],
                last_name: '-', // Catalyst requires last name, use placeholder if null
                email_id: email
            };
            
            const registeredUser = await req.catalystApp.userManagement().registerUser(signupConfig, userConfig);
            catalystUserId = registeredUser.user_id;
        } catch (authErr) {
            console.error("Failed to provision Catalyst User", authErr);
            return res.status(500).json({ success: false, message: 'Failed to create secure identity for user: ' + (authErr.message || "Unknown Error") });
        }
        
        // 2. Map the identity to our local Datastore
        const datastore = getDatastore(req);
        
        const insertData = {
            user_id: catalystUserId,
            tenant_id: req.tenantId, // Link to current workspace
            name,
            email,
            role: role || 'Staff',
            phone: phone || '',
            designation: designation || '',
            gender: gender || '',
            dob: dob || '',
            status: status || 'Active',
            color: color || '#E0E7FF',
            initials: initials || (name ? name.substring(0, 2).toUpperCase() : (email.substring(0,2).toUpperCase()))
        };
        
        const row = await datastore.table('Users').insertRow(insertData);
        res.status(201).json({ success: true, data: row });
    } catch (err) {
        next(err);
    }
});

// PUT: Update an existing employee/user
router.put('/:id', async (req, res, next) => {
    try {
        const userId = req.params.id;
        const datastore = getDatastore(req);
        
        // Ensure the record belongs to the tenant before updating
        const query = `SELECT ROWID FROM Users WHERE tenant_id = '${req.tenantId}' AND user_id = '${userId}'`;
        const existing = await executeZCQL(req, query);
        if (!existing || existing.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const rowId = existing[0].Users.ROWID;

        const updateData = {
            ROWID: rowId,
            ...req.body
        };
        
        const updatedRow = await datastore.table('Users').updateRow(updateData);
        res.json({ success: true, data: updatedRow });
    } catch (err) {
        next(err);
    }
});

// DELETE: Delete an employee/user
router.delete('/:id', async (req, res, next) => {
    try {
        const userId = req.params.id;
        const datastore = getDatastore(req);
        
        const query = `SELECT ROWID FROM Users WHERE tenant_id = '${req.tenantId}' AND user_id = '${userId}'`;
        const existing = await executeZCQL(req, query);
        if (!existing || existing.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        const rowId = existing[0].Users.ROWID;
        await datastore.table('Users').deleteRow(rowId);
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
