const express = require('express');
const router = express.Router();

// ─────────────────────────────────────────────────────────────
// Auth routes are currently disabled.
// Login/Signup will be re-implemented later with Catalyst
// embedded auth. For now, all routes are open.
// ─────────────────────────────────────────────────────────────

// GET /me — Stub endpoint (returns mock user for dev)
router.get('/me', (req, res) => {
    res.json({
        success: true,
        user: {
            user_id: 'dev-user-1',
            email_id: 'admin@bookingsplus.dev',
            first_name: 'Admin',
            last_name: 'User',
            role: 'Admin',
            tenant_id: 'dev-tenant-1',
            organization_id: 'dev-org-1',
        },
    });
});

module.exports = router;
