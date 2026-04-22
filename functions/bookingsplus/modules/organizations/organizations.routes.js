const express = require('express');
const router = express.Router();
const asyncHandler = require('../../core/async-handler');
const response = require('../../core/response');
const { ForbiddenError } = require('../../core/errors');
const authMiddleware = require('../../middleware/auth.middleware');
const orgService = require('./organizations.service');

router.use(authMiddleware);

/** POST /setup — Full onboarding flow */
router.post('/setup', asyncHandler(async (req, res) => {
    const result = await orgService.setupOrganization(req, req.body);
    return response.success(res, result, 'Organization and workspace provisioned successfully.');
}));

/** GET / — Get organization details */
router.get('/', asyncHandler(async (req, res) => {
    const result = await orgService.getOrganization(req);
    return response.success(res, result);
}));

/** PUT / — Update organization (super admin only) */
router.put('/', asyncHandler(async (req, res) => {
    if (!req.user.is_super_admin) throw new ForbiddenError('Super Admin access required.');
    const updated = await orgService.updateOrganization(req, req.body);
    return response.success(res, updated);
}));

module.exports = router;
