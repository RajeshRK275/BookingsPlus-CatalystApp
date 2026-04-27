const express = require('express');
const router = express.Router();
const { getDatastore, executeZCQL, insertAuditLog, catalystDateTime } = require('../../utils/datastore');
const { seedRolesForWorkspace } = require('../../utils/seed-roles');

// All routes guarded by superAdminGuard in index.js

/** Coerce any value to a safe BIGINT-compatible number for Catalyst Data Store */
const toBigInt = (value) => {
    if (value === null || value === undefined) return Date.now();
    if (typeof value === 'number' && !isNaN(value)) return value;
    const parsed = parseInt(String(value), 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
    return Date.now();
};

// GET / — List all workspaces
router.get('/', async (req, res, next) => {
    try {
        const result = await executeZCQL(req, 'SELECT * FROM Workspaces');
        const workspaces = result.map(r => ({ ...r.Workspaces, id: r.Workspaces.ROWID }));
        res.json({ success: true, count: workspaces.length, data: workspaces });
    } catch (err) {
        next(err);
    }
});

// POST / — Create a new workspace
router.post('/', async (req, res, next) => {
    try {
        const { workspace_name, workspace_slug, description, brand_color } = req.body;
        if (!workspace_name) {
            return res.status(400).json({ success: false, message: 'workspace_name is required.' });
        }

        const slug = workspace_slug || workspace_name.toLowerCase().replace(/[^a-z0-9]/g, '-');

        // Check slug uniqueness
        const existing = await executeZCQL(req, `SELECT ROWID FROM Workspaces WHERE workspace_slug = '${slug}'`);
        if (existing.length > 0) {
            return res.status(409).json({ success: false, message: `Workspace slug "${slug}" already exists.` });
        }

        const datastore = getDatastore(req);
        // created_by is BIGINT — must be numeric, not 'temp-xxx' strings
        const createdByUserId = toBigInt(req.user.ROWID || req.user.user_id);
        const wsRow = await datastore.table('Workspaces').insertRow({
            workspace_id: Date.now(),
            workspace_name,
            workspace_slug: slug,
            description: description || '',
            brand_color: brand_color || '#5C44B5',
            status: 'active',
            created_by: createdByUserId,
            created_at: catalystDateTime(),
        });

        // Seed default roles
        const roleMap = await seedRolesForWorkspace(req, wsRow.ROWID);

        // Add creator as Owner — all _id columns are BIGINT
        const ownerRoleId = roleMap['Owner'];
        await datastore.table('UserWorkspaces').insertRow({
            user_workspace_id: Date.now() + 1,
            user_id: toBigInt(req.user.ROWID || req.user.user_id),
            workspace_id: toBigInt(wsRow.ROWID),
            role_id: toBigInt(ownerRoleId),
            status: 'active',
            joined_at: catalystDateTime(),
        });

        await insertAuditLog(req, {
            workspaceId: wsRow.ROWID,
            userId: req.user.user_id,
            action: 'workspace.created',
            resourceType: 'Workspace',
            resourceId: wsRow.ROWID,
            details: { workspace_name, workspace_slug: slug },
        });

        res.status(201).json({ success: true, data: wsRow });
    } catch (err) {
        next(err);
    }
});

// PUT /:id — Update workspace
router.put('/:id', async (req, res, next) => {
    try {
        const datastore = getDatastore(req);
        const updateData = { ROWID: req.params.id, ...req.body };
        delete updateData.workspace_id;
        const updated = await datastore.table('Workspaces').updateRow(updateData);
        res.json({ success: true, data: updated });
    } catch (err) {
        next(err);
    }
});

// POST /:id/suspend — Suspend workspace
router.post('/:id/suspend', async (req, res, next) => {
    try {
        const datastore = getDatastore(req);
        await datastore.table('Workspaces').updateRow({ ROWID: req.params.id, status: 'suspended' });
        await insertAuditLog(req, { userId: req.user.user_id, action: 'workspace.suspended', resourceType: 'Workspace', resourceId: req.params.id });
        res.json({ success: true, message: 'Workspace suspended.' });
    } catch (err) {
        next(err);
    }
});

// POST /:id/activate — Activate workspace
router.post('/:id/activate', async (req, res, next) => {
    try {
        const datastore = getDatastore(req);
        await datastore.table('Workspaces').updateRow({ ROWID: req.params.id, status: 'active' });
        await insertAuditLog(req, { userId: req.user.user_id, action: 'workspace.activated', resourceType: 'Workspace', resourceId: req.params.id });
        res.json({ success: true, message: 'Workspace activated.' });
    } catch (err) {
        next(err);
    }
});

// DELETE /:id — Delete workspace
router.delete('/:id', async (req, res, next) => {
    try {
        const datastore = getDatastore(req);
        await datastore.table('Workspaces').deleteRow(req.params.id);
        await insertAuditLog(req, { userId: req.user.user_id, action: 'workspace.deleted', resourceType: 'Workspace', resourceId: req.params.id });
        res.json({ success: true, message: 'Workspace deleted.' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
