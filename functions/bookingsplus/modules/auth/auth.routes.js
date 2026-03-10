const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const config = require('../../utils/config');

// Login Route (Normally validates against Datastore Users table)
router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        
        // Mock DB Verification
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password required' });
        }

        // Simulating matching record from Datastore
        const mockUser = {
            user_id: 101,
            tenant_id: 'org123',
            organization_id: 501,
            role: 'Admin', // Admin, Manager, Staff, Customer
            name: 'System Admin'
        };

        const token = jwt.sign(
            { 
               user_id: mockUser.user_id, 
               tenant_id: mockUser.tenant_id, 
               organization_id: mockUser.organization_id,
               role: mockUser.role 
            },
            config.jwtSecret,
            { expiresIn: config.tokenExpiry }
        );

        res.json({ 
            success: true, 
            token,
            user: mockUser
        });

    } catch (err) {
        next(err);
    }
});

module.exports = router;
