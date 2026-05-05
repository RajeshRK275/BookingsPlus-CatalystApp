'use strict';

const express = require('express');
const router = express.Router();
const { executeZCQL, getDatastore } = require('../../utils/datastore');

/**
 * Data Reset API
 * 
 * DELETE /api/v1/admin/reset/all-data
 * 
 * Deletes ALL rows from ALL tables in the correct dependency order.
 * After this, the app restarts fresh from the onboarding screen.
 * 
 * Protected by: authMiddleware + superAdminGuard
 * (Only the super admin who set up the org can do this)
 */

// Tables in deletion order (children/dependents first, parents last)
const DELETION_ORDER = [
    'AuditLog',              // No dependents
    'WorkspaceSettings',     // No dependents
    'Integrations',          // No dependents
    'Appointment_Approvals', // Depends on Appointments
    'Appointments',          // Depends on Services, Staff, Customers
    'ServiceStaff',          // Depends on Services, Staff
    'Availability',          // Depends on Staff
    'Staff',                 // Depends on Users, Workspaces
    'Services',              // Depends on Workspaces
    'Customers',             // Depends on Workspaces
    'RolePermissions',       // Depends on Roles, Permissions
    'Roles',                 // Depends on Workspaces
    'UserRoleMapping',       // Depends on Users
    'UserWorkspaces',        // Depends on Users, Workspaces
    'Permissions',           // Standalone seed data
    'Users',                 // Depends on Organization
    'Workspaces',            // Depends on Organization
    'Organization',          // Root table — deleted last
];

/**
 * Delete all rows from a single table.
 * Catalyst Data Store doesn't support `DELETE FROM table` via ZCQL,
 * so we have to:
 *   1. SELECT all ROWIDs
 *   2. Delete each row by ROWID using the SDK
 */
const deleteAllRowsFromTable = async (req, tableName) => {
    const results = {
        table: tableName,
        found: 0,
        deleted: 0,
        errors: [],
    };

    try {
        // Fetch all ROWIDs from the table
        const rows = await executeZCQL(req, `SELECT ROWID FROM ${tableName}`);
        results.found = rows.length;

        if (rows.length === 0) {
            return results;
        }

        const datastore = getDatastore(req);
        const table = datastore.table(tableName);

        // Delete in batches — Catalyst SDK supports deleteRows with array of ROWIDs
        const rowIds = rows.map(r => {
            const data = r[tableName] || r;
            return data.ROWID;
        }).filter(Boolean);

        // Delete in chunks of 200 (Catalyst batch limit)
        const BATCH_SIZE = 200;
        for (let i = 0; i < rowIds.length; i += BATCH_SIZE) {
            const batch = rowIds.slice(i, i + BATCH_SIZE);
            try {
                // Try bulk delete first
                await table.deleteRows(batch);
                results.deleted += batch.length;
            } catch (bulkErr) {
                // Fallback: delete one by one
                console.warn(`[Reset] Bulk delete failed for ${tableName}, falling back to individual deletes:`, bulkErr.message);
                for (const rowId of batch) {
                    try {
                        await table.deleteRow(rowId);
                        results.deleted++;
                    } catch (singleErr) {
                        results.errors.push(`ROWID ${rowId}: ${singleErr.message}`);
                    }
                }
            }
        }
    } catch (err) {
        // Table might not exist — that's fine
        if (err.message && (err.message.includes('does not exist') || err.message.includes('no such table'))) {
            results.found = 0;
            results.deleted = 0;
            results.errors.push(`Table does not exist (OK — nothing to delete)`);
        } else {
            results.errors.push(`Query failed: ${err.message}`);
        }
    }

    return results;
};

/**
 * GET /api/v1/admin/reset/preview
 * 
 * Shows row counts for all tables WITHOUT deleting anything.
 * Use this to see what will be affected before running the reset.
 */
router.get('/preview', async (req, res) => {
    try {
        const preview = {};
        let totalRows = 0;

        for (const tableName of DELETION_ORDER) {
            try {
                const countResult = await executeZCQL(req, `SELECT COUNT(ROWID) as cnt FROM ${tableName}`);
                const count = parseInt((countResult[0]?.[tableName]?.cnt) || 0);
                preview[tableName] = count;
                totalRows += count;
            } catch (err) {
                preview[tableName] = err.message.includes('does not exist') ? 'TABLE_NOT_FOUND' : `ERROR: ${err.message}`;
            }
        }

        return res.status(200).json({
            success: true,
            message: `Found ${totalRows} total rows across ${DELETION_ORDER.length} tables. Use DELETE /all-data to wipe everything.`,
            data: {
                tables: preview,
                total_rows: totalRows,
                deletion_order: DELETION_ORDER,
                warning: '⚠️ Deleting all data will reset the app to the onboarding screen. This CANNOT be undone.',
            },
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: 'Preview failed: ' + err.message,
        });
    }
});

/**
 * DELETE /api/v1/admin/reset/all-data
 * 
 * ⚠️ DESTRUCTIVE — Deletes ALL data from ALL tables.
 * The app will restart at the onboarding screen.
 * 
 * Requires confirmation header: X-Confirm-Reset: YES_DELETE_EVERYTHING
 */
router.delete('/all-data', async (req, res) => {
    // Safety check: require explicit confirmation header
    const confirmation = req.headers['x-confirm-reset'];
    if (confirmation !== 'YES_DELETE_EVERYTHING') {
        return res.status(400).json({
            success: false,
            message: 'Safety check failed. Send header "X-Confirm-Reset: YES_DELETE_EVERYTHING" to confirm.',
            hint: 'Use GET /api/v1/admin/reset/preview first to see what will be deleted.',
        });
    }

    console.log('========================================');
    console.log('[RESET] ⚠️  FULL DATA RESET INITIATED');
    console.log('[RESET] Requested by:', req.user?.email || 'unknown');
    console.log('[RESET] Timestamp:', new Date().toISOString());
    console.log('========================================');

    const report = {
        tables: {},
        total_found: 0,
        total_deleted: 0,
        total_errors: 0,
        started_at: new Date().toISOString(),
    };

    for (const tableName of DELETION_ORDER) {
        console.log(`[RESET] Clearing table: ${tableName}...`);
        const result = await deleteAllRowsFromTable(req, tableName);
        report.tables[tableName] = result;
        report.total_found += result.found;
        report.total_deleted += result.deleted;
        report.total_errors += result.errors.length;
        console.log(`[RESET]   → ${tableName}: ${result.deleted}/${result.found} deleted${result.errors.length > 0 ? ` (${result.errors.length} errors)` : ''}`);
    }

    report.completed_at = new Date().toISOString();
    report.success = report.total_errors === 0;

    console.log('========================================');
    console.log(`[RESET] ✅ COMPLETE: ${report.total_deleted}/${report.total_found} rows deleted`);
    if (report.total_errors > 0) {
        console.log(`[RESET] ⚠️  ${report.total_errors} errors occurred`);
    }
    console.log('========================================');

    return res.status(200).json({
        success: true,
        message: `Data reset complete. ${report.total_deleted}/${report.total_found} rows deleted across ${DELETION_ORDER.length} tables.${report.total_errors > 0 ? ` ${report.total_errors} errors occurred.` : ''} Clear browser localStorage and refresh to start onboarding.`,
        data: report,
        next_steps: [
            '1. Clear browser localStorage (the app will do this automatically)',
            '2. Refresh the page',
            '3. You will see the onboarding screen',
            '4. Set up your organization from scratch',
        ],
    });
});

module.exports = router;
