// Environment configuration mapping
require('dotenv').config();

module.exports = {
    jwtSecret: process.env.JWT_SECRET || 'fallback-secret-for-dev',
    tokenExpiry: process.env.TOKEN_EXPIRY || '24h',
    environment: process.env.NODE_ENV || 'development',
    devMode: process.env.DEV_MODE === 'true',
    enableAuditLog: process.env.ENABLE_AUDIT_LOG !== 'false',
    adminWebhookSecret: process.env.ADMIN_WEBHOOK_SECRET || 'bp-admin-secret-dev',
    initialSuperAdminEmail: process.env.INITIAL_SUPER_ADMIN_EMAIL || '',
    defaultWorkspaceRoles: (process.env.DEFAULT_WORKSPACE_ROLES || 'Owner,Admin,Manager,Staff').split(','),
};
