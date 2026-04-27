const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const catalyst = require('zcatalyst-sdk-node');

const app = express();

// ── Core Middleware ──
app.use(helmet());
app.use(cors());
app.use(express.json());

// ── Catalyst SDK Initialization ──
app.use((req, res, next) => {
    // In dev mode, if catalystApp is already injected (by dev-server.js), skip SDK init
    if (req.catalystApp) {
        return next();
    }
    try {
        req.catalystApp = catalyst.initialize(req);
    } catch (err) {
        // In local dev, Catalyst SDK init fails — use a no-op placeholder
        console.error('Catalyst SDK init failed (expected in local dev):', err.message);
        return res.status(500).json({ success: false, message: 'Catalyst SDK not available. Use dev-server.js for local development.' });
    }
    next();
});

// ── Import Middleware ──
const authMiddleware = require('./middleware/auth.middleware');
const workspaceMiddleware = require('./middleware/workspace.middleware');
const superAdminGuard = require('./middleware/superadmin.middleware');
const webhookAuth = require('./middleware/webhook.middleware');

// ── Import Routes ──
// Auth (no workspace scope needed)
const authRoutes = require('./modules/auth/auth.routes');
// Organization (auth only, no workspace scope)
const organizationsRoutes = require('./modules/organizations/organizations.routes');
// Workspaces (auth only, no workspace scope)
const workspacesRoutes = require('./modules/workspaces/workspaces.routes');
// Workspace-scoped routes (auth + workspace)
const usersRoutes = require('./modules/users/users.routes');
const servicesRoutes = require('./modules/services/services.routes');
const appointmentsRoutes = require('./modules/appointments/appointments.routes');
const customersRoutes = require('./modules/customers/customers.routes');
// Admin routes (auth + super admin)
const adminWorkspacesRoutes = require('./modules/admin/admin.workspaces.routes');
const adminUsersRoutes = require('./modules/admin/admin.users.routes');
const adminRolesRoutes = require('./modules/admin/admin.roles.routes');
const adminPermissionsRoutes = require('./modules/admin/admin.permissions.routes');
const adminAuditRoutes = require('./modules/admin/admin.audit.routes');
const adminWebhookRoutes = require('./modules/admin/admin.webhook.routes');
const adminMigrateRoutes = require('./modules/admin/admin.migrate.routes');

// ═══════════════════════════════════════════════════
// API V1 Routes
// ═══════════════════════════════════════════════════

// Auth — no workspace scope needed (handles /me, /me/permissions)
app.use('/api/v1/auth', authRoutes);

// Organization — auth only (setup, get org details)
app.use('/api/v1/organizations', organizationsRoutes);

// Workspaces — auth only (list user's workspaces, get workspace details)
app.use('/api/v1/workspaces', workspacesRoutes);

// Workspace-scoped routes — auth + workspace middleware
app.use('/api/v1/users', authMiddleware, workspaceMiddleware, usersRoutes);
app.use('/api/v1/services', authMiddleware, workspaceMiddleware, servicesRoutes);
app.use('/api/v1/appointments', authMiddleware, workspaceMiddleware, appointmentsRoutes);
app.use('/api/v1/customers', authMiddleware, workspaceMiddleware, customersRoutes);

// Admin routes — auth + super admin guard
app.use('/api/v1/admin/workspaces', authMiddleware, superAdminGuard, adminWorkspacesRoutes);
app.use('/api/v1/admin/users', authMiddleware, superAdminGuard, adminUsersRoutes);
app.use('/api/v1/admin/roles', authMiddleware, superAdminGuard, adminRolesRoutes);
app.use('/api/v1/admin/permissions', authMiddleware, superAdminGuard, adminPermissionsRoutes);
app.use('/api/v1/admin/audit', authMiddleware, superAdminGuard, adminAuditRoutes);

// Admin webhook — protected by X-Admin-Secret header (NOT Catalyst auth)
app.use('/api/v1/admin/webhook', adminWebhookRoutes);

// Admin migration tool — protected by X-Admin-Secret header (same auth as webhook)
app.use('/api/v1/admin/migrate-datastore', webhookAuth, adminMigrateRoutes);

// ── Centralized Error Handler ──
const { AppError } = require('./core/errors');

app.use((err, req, res, next) => {
    // Operational errors (thrown intentionally by our code)
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            success: false,
            message: err.message,
            code: err.code,
            ...(err.details ? { details: err.details } : {}),
        });
    }

    // ── All other errors — ALWAYS pass through the real message ──
    // Users/admins need actionable error messages. Hiding them behind
    // "Internal Server Error" makes debugging impossible.
    console.error('Unhandled Server Error:', err.stack || err);

    const errMessage = err.message || 'An unexpected error occurred';
    let userMessage = errMessage;
    let errorCode = 'INTERNAL_ERROR';
    let statusCode = err.status || err.statusCode || 500;
    const lowerMsg = errMessage.toLowerCase();

    // Classify common Catalyst Data Store errors for actionable messages
    if (lowerMsg.includes('mandatory') && (lowerMsg.includes('column') || lowerMsg.includes('empty'))) {
        userMessage = `Database configuration error: ${errMessage}. Please verify all required columns exist and are correctly configured in the Catalyst Data Store console.`;
        errorCode = 'DATASTORE_CONFIG_ERROR';
    } else if (lowerMsg.includes('invalid input value for column') || lowerMsg.includes('invalid column')) {
        userMessage = `Database schema mismatch: ${errMessage}. A required column may be missing or misconfigured in the Data Store.`;
        errorCode = 'DATASTORE_SCHEMA_ERROR';
    } else if (lowerMsg.includes('does not exist') && (lowerMsg.includes('table') || lowerMsg.includes('relation'))) {
        userMessage = `Database table missing: ${errMessage}. Please create all required tables in the Catalyst Data Store console.`;
        errorCode = 'DATASTORE_TABLE_MISSING';
    } else if (lowerMsg.includes('no such table') || lowerMsg.includes('unknown table')) {
        userMessage = `Database table not found: ${errMessage}. Ensure the table has been created in Catalyst Data Store.`;
        errorCode = 'DATASTORE_TABLE_MISSING';
    } else if (lowerMsg.includes('network') || lowerMsg.includes('econnrefused') || lowerMsg.includes('timeout') || lowerMsg.includes('econnreset')) {
        userMessage = `Service connectivity issue: ${errMessage}. Please try again in a moment.`;
        errorCode = 'SERVICE_UNAVAILABLE';
        statusCode = 503;
    } else if (lowerMsg.includes('setup failed')) {
        errorCode = 'SETUP_ERROR';
    }

    res.status(statusCode).json({
        success: false,
        message: userMessage,
        code: errorCode,
    });
});

module.exports = app;
