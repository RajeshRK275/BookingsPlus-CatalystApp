/**
 * Public Service Routes — Authenticated but no workspace scope required.
 * 
 * These routes expose service details for public booking links.
 * They require Catalyst platform-level authentication (mandatory for
 * Advanced I/O functions) but do NOT require workspace context or
 * workspace-level permissions.
 * 
 * Route: /api/v1/booking/services/*
 * Auth: Catalyst platform auth (via authMiddleware)
 * Workspace: NOT required (queries service directly by service_id)
 * Permissions: NOT checked (service details are public for booking)
 */
const express = require('express');
const router = express.Router();
const asyncHandler = require('../../core/async-handler');
const response = require('../../core/response');
const servicesService = require('./services.service');

/**
 * GET /api/v1/booking/services/:id
 * 
 * Fetch a service's public details by service_id.
 * Used by the public booking page to display service info
 * (name, duration, type, description, etc.)
 */
router.get('/:id', asyncHandler(async (req, res) => {
    console.log('[PublicBooking] GET /api/v1/booking/services/' + req.params.id);
    const service = await servicesService.getPublicById(req, req.params.id);
    return response.success(res, service);
}));

module.exports = router;
