const express = require('express');
const router = express.Router();
const { executeZCQL } = require('../../utils/datastore');

// All routes guarded by superAdminGuard in index.js

// GET / — Get all audit log entries (paginated, filterable)
router.get('/', async (req, res, next) => {
    try {
        const { workspace_id, user_id, action, limit } = req.query;
        let query = 'SELECT * FROM AuditLog';
        const conditions = [];

        if (workspace_id) conditions.push(`workspace_id = '${workspace_id}'`);
        if (user_id) conditions.push(`user_id = '${user_id}'`);
        if (action) conditions.push(`action = '${action}'`);

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY created_at DESC';
        if (limit) query += ` LIMIT ${parseInt(limit) || 100}`;

        const result = await executeZCQL(req, query);
        const logs = result.map(r => ({ id: r.AuditLog.ROWID, ...r.AuditLog }));
        res.json({ success: true, count: logs.length, data: logs });
    } catch (err) {
        next(err);
    }
});

// GET /workspace/:wsId — Get audit logs for a specific workspace
router.get('/workspace/:wsId', async (req, res, next) => {
    try {
        const result = await executeZCQL(req,
            `SELECT * FROM AuditLog WHERE workspace_id = '${req.params.wsId}' ORDER BY created_at DESC LIMIT 200`
        );
        const logs = result.map(r => ({ id: r.AuditLog.ROWID, ...r.AuditLog }));
        res.json({ success: true, count: logs.length, data: logs });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
