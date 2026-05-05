/**
 * Public Appointments Routes — Unauthenticated booking endpoints.
 * These routes do NOT require authentication or workspace context.
 * Used by customers accessing public booking links (e.g., /book/{serviceId})
 */
const express = require('express');
const router = express.Router();
const asyncHandler = require('../../core/async-handler');
const response = require('../../core/response');
const appointmentsService = require('./appointments.service');

/**
 * POST /api/v1/public/appointments/book
 * 
 * Public appointment booking endpoint for customers.
 * No authentication required.
 * 
 * Request body:
 * {
 *   service_id: string,
 *   customer_name: string,
 *   customer_email: string,
 *   customer_phone?: string,
 *   start_time: string (ISO 8601),
 *   end_time: string (ISO 8601),
 *   notes?: string
 * }
 */
router.post('/book', asyncHandler(async (req, res) => {
    const row = await appointmentsService.bookPublic(req, req.body);
    return response.created(res, row);
}));

module.exports = router;
