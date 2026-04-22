/**
 * Webhook Auth Middleware — Protects the admin webhook endpoint.
 * 
 * Validates the X-Admin-Secret header against the configured secret.
 * Only requests from the known admin app with the correct token are processed.
 */
const config = require('../utils/config');

const webhookAuth = (req, res, next) => {
    const secret = req.headers['x-admin-secret'];

    if (!secret || secret !== config.adminWebhookSecret) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or missing webhook secret.'
        });
    }

    next();
};

module.exports = webhookAuth;
