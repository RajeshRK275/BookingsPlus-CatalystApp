const express = require('express');
const router = express.Router();
const asyncHandler = require('../../core/async-handler');
const response = require('../../core/response');
const { NotFoundError } = require('../../core/errors');
const authMiddleware = require('../../middleware/auth.middleware');
const workspacesService = require('./workspaces.service');

router.use(authMiddleware);

/** GET /my-workspaces — User's workspaces for sidebar switcher */
router.get('/my-workspaces', asyncHandler(async (req, res) => {
    let workspaces = await workspacesService.getMyWorkspaces(req);
    // Auto-repair workspaces that were created without a name (bug fix for initial setup)
    if (workspaces.some(ws => ws._needsNameRepair)) {
        workspaces = await workspacesService.autoRepairWorkspaceNames(req, workspaces);
    }
    // Strip internal repair flags before sending to client
    const cleaned = workspaces.map(({ _rawROWID, _needsNameRepair, ...ws }) => ws);
    return response.success(res, cleaned);
}));

/** PUT /:id — Update workspace details (admin/owner only) */
router.put('/:id', asyncHandler(async (req, res) => {
    const updated = await workspacesService.updateWorkspace(req, req.params.id, req.body);
    return response.success(res, updated, 'Workspace updated successfully.');
}));

/** GET /:id — Workspace details by ID */
router.get('/:id', asyncHandler(async (req, res) => {
    const ws = await workspacesService.getById(req, req.params.id);
    if (!ws) throw new NotFoundError('Workspace', req.params.id);
    return response.success(res, ws);
}));

/** GET /by-slug/:slug — Workspace by slug (public booking pages) */
router.get('/by-slug/:slug', asyncHandler(async (req, res) => {
    const ws = await workspacesService.getBySlug(req, req.params.slug);
    if (!ws) throw new NotFoundError('Workspace', req.params.slug);
    return response.success(res, ws);
}));

module.exports = router;
