/**
 * Public Booking Routes — Authenticated but no workspace scope required.
 * 
 * These routes handle public booking links shared externally. They require
 * Catalyst platform-level authentication (mandatory for Advanced I/O functions)
 * but do NOT require workspace context or workspace-level permissions.
 * 
 * The workspace and organization context are resolved from the service_id
 * by the bookPublic() service function.
 * 
 * Route: /api/v1/booking/*
 * Auth: Catalyst platform auth (via authMiddleware)
 * Workspace: NOT required (resolved from service)
 * Permissions: NOT checked (any authenticated user can book)
 */
const express = require('express');
const router = express.Router();
const asyncHandler = require('../../core/async-handler');
const response = require('../../core/response');
const appointmentsService = require('./appointments.service');

/**
 * POST /api/v1/booking/book
 * 
 * Public appointment booking. Any authenticated Catalyst user can book
 * an appointment through a shared public booking link.
 * 
 * The backend resolves workspace_id and organization_id from the service_id
 * in the request body, so no X-Workspace-Id header is needed.
 */
router.post('/book', asyncHandler(async (req, res) => {
    console.log('[PublicBooking] POST /api/v1/booking/book — user:', req.user?.email);
    const row = await appointmentsService.bookPublic(req, req.body);
    return response.created(res, row);
}));

module.exports = router;
