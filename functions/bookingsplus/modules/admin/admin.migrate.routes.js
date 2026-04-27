/**
 * Admin Migration Routes
 * 
 * Exposes the Data Store migration tool via a protected API endpoint.
 * Protected by X-Admin-Secret header (same as webhook routes).
 *
 * GET  /api/v1/admin/migrate-datastore/guide  → Returns the full step-by-step migration guide
 * POST /api/v1/admin/migrate-datastore/run    → Runs automated migration checks & column additions
 * GET  /api/v1/admin/migrate-datastore/status → Returns current schema alignment status
 */

'use strict';

const express = require('express');
const router = express.Router();
const { runMigration, generateMigrationGuide, MIGRATION_PLAN } = require('../../utils/migrate-datastore');
const { executeZCQL } = require('../../utils/datastore');
const { validateSchema } = require('../../utils/schema-validator');

// ── GET /guide — Returns the complete human-readable migration guide ──────────
router.get('/guide', async (req, res) => {
    try {
        const guide = generateMigrationGuide();
        return res.status(200).json({
            success: true,
            message: 'Migration guide generated. Follow each step in the Catalyst Console.',
            data: guide,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: 'Failed to generate migration guide: ' + err.message,
        });
    }
});

// ── POST /run — Runs automated migration (validates columns, reports missing ones) ─
router.post('/run', async (req, res) => {
    try {
        console.log('[Migration] Starting Data Store migration run...');
        const report = await runMigration(req);
        console.log('[Migration] Completed:', report.message);

        return res.status(report.success ? 200 : 207).json({
            success: report.success,
            message: report.message,
            data: report,
        });
    } catch (err) {
        console.error('[Migration] Fatal error:', err);
        return res.status(500).json({
            success: false,
            message: 'Migration run failed: ' + err.message,
        });
    }
});

// ── GET /status — Checks current schema alignment status ─────────────────────
router.get('/status', async (req, res) => {
    try {
        const status = {
            timestamp: new Date().toISOString(),
            tables: {},
            overall_ready: true,
        };

        // Check each table
        const tablesToCheck = [
            'Organization', 'Workspaces', 'Users', 'UserWorkspaces',
            'Permissions', 'Roles', 'RolePermissions', 'UserRoleMapping',
            'Services', 'Staff', 'Availability', 'Customers',
            'Appointments', 'Appointment_Approvals', 'Integrations',
            'ServiceStaff', 'AuditLog', 'WorkspaceSettings',
        ];

        for (const table of tablesToCheck) {
            try {
                const result = await executeZCQL(req, `SELECT * FROM ${table} LIMIT 1`);
                const existingCols = result.length > 0
                    ? Object.keys(result[0][table] || {})
                    : [];

                // Check against expected columns from MIGRATION_PLAN
                const plan = MIGRATION_PLAN[table];
                let missingCols = [];

                if (plan) {
                    const expectedCols = plan.action === 'add_columns'
                        ? plan.columns_to_add.map(c => c.name)
                        : (plan.columns || []).map(c => c.name);

                    missingCols = expectedCols.filter(
                        col => !existingCols.map(c => c.toLowerCase()).includes(col.toLowerCase())
                    );
                }

                status.tables[table] = {
                    exists: true,
                    existing_columns: existingCols,
                    missing_columns: missingCols,
                    ready: missingCols.length === 0,
                };

                if (missingCols.length > 0) {
                    status.overall_ready = false;
                }

            } catch (e) {
                status.tables[table] = {
                    exists: false,
                    error: e.message,
                    ready: false,
                };
                status.overall_ready = false;
            }
        }

        // Special check: warn about "Organizations" (plural) vs "Organization" (singular)
        try {
            await executeZCQL(req, `SELECT ROWID FROM Organizations LIMIT 1`);
            status.organizations_warning = {
                issue: 'Table "Organizations" (plural) found. Code expects "Organization" (singular).',
                action: 'Create a new table named "Organization" in the Catalyst Console.',
            };
            status.overall_ready = false;
        } catch (e) {
            // No "Organizations" table — good
        }

        return res.status(200).json({
            success: true,
            data: status,
            summary: {
                total_tables: Object.keys(status.tables).length,
                ready_tables: Object.values(status.tables).filter(t => t.ready).length,
                missing_tables: Object.values(status.tables).filter(t => !t.exists).length,
                tables_with_missing_cols: Object.values(status.tables).filter(t => t.exists && !t.ready).length,
                overall_ready: status.overall_ready,
            },
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: 'Status check failed: ' + err.message,
        });
    }
});

// ── GET /validate-schema — Deep schema validation with type checking ──────────
router.get('/validate-schema', async (req, res) => {
    try {
        console.log('[Schema Validator] Running deep schema validation...');
        const report = await validateSchema(req);

        const statusCode = report.valid ? 200 : 422;
        return res.status(statusCode).json({
            success: report.valid,
            message: report.valid
                ? '✅ All tables and column types are correctly configured.'
                : `❌ Schema validation failed — ${report.errors.length} issue(s) found. Fix them in the Catalyst Console.`,
            data: report,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: 'Schema validation failed: ' + err.message,
        });
    }
});

module.exports = router;
