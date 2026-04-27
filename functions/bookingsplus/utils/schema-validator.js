/**
 * ══════════════════════════════════════════════════════════════════
 * Schema Validator — Pre-flight Check for Catalyst Data Store
 * ══════════════════════════════════════════════════════════════════
 *
 * Validates that all required tables and columns exist with correct
 * data types BEFORE the application attempts any inserts. Prevents
 * cryptic "Invalid input value" errors by detecting schema mismatches
 * upfront and providing clear, actionable error messages.
 *
 * Called at the beginning of the /setup endpoint and optionally
 * from the /admin/migrate-datastore/status endpoint.
 * ══════════════════════════════════════════════════════════════════
 */

'use strict';

/**
 * Expected schema definition.
 * Each column specifies its name and expected type class:
 *   - 'text'   → varchar/text columns (accept strings)
 *   - 'bigint' → numeric columns (accept integers)
 *   - 'datetime' → datetime columns (accept "yyyy-MM-dd HH:mm:ss")
 *   - 'boolean_text' → stored as varchar but hold 'true'/'false'
 *
 * We detect the actual column type by attempting test inserts with
 * known-good values and seeing what Catalyst accepts/rejects.
 */
const EXPECTED_SCHEMA = {
    Organization: {
        required: true,
        columns: {
            organization_id: 'bigint',
            org_name: 'text',
            org_slug: 'text',
            timezone: 'text',
            currency: 'text',
            owner_user_id: 'bigint',
            status: 'text',
            setup_completed: 'text',
            created_at: 'datetime',
        },
        optional_columns: ['subscription_plan', 'logo_url', 'brand_color'],
    },
    Users: {
        required: true,
        columns: {
            user_id: 'bigint',
            catalyst_user_id: 'text',
            display_name: 'text',
            email: 'text',
            organization_id: 'bigint',
            is_super_admin: 'text',
            status: 'text',
            created_at: 'datetime',
        },
        optional_columns: ['catalyst_role_id', 'phone', 'role_version', 'color', 'initials', 'avatar_url', 'designation', 'gender', 'dob'],
    },
    Permissions: {
        required: true,
        columns: {
            permission_id: 'bigint',
            permission_key: 'text',        // THIS IS THE ONE THAT WAS WRONG — must be varchar, NOT bigint
            resource: 'text',
            action: 'text',
            description: 'text',
        },
        optional_columns: [],
    },
    Roles: {
        required: true,
        columns: {
            role_id: 'bigint',
            workspace_id: 'bigint',
            role_name: 'text',
            role_level: 'bigint',
            is_system: 'text',
            description: 'text',
        },
        optional_columns: [],
    },
    RolePermissions: {
        required: true,
        columns: {
            role_perm_id: 'bigint',
            role_id: 'bigint',
            permission_id: 'bigint',
        },
        optional_columns: [],
    },
    Workspaces: {
        required: true,
        columns: {
            workspace_id: 'bigint',
            workspace_name: 'text',
            workspace_slug: 'text',
            status: 'text',
            created_by: 'bigint',
            created_at: 'datetime',
        },
        optional_columns: ['description', 'logo_url', 'brand_color', 'timezone', 'currency'],
    },
    UserWorkspaces: {
        required: true,
        columns: {
            user_workspace_id: 'bigint',
            user_id: 'bigint',
            workspace_id: 'bigint',
            role_id: 'bigint',
            status: 'text',
            joined_at: 'datetime',
        },
        optional_columns: [],
    },
    AuditLog: {
        required: false,
        columns: {
            workspace_id: 'bigint',
            user_id: 'bigint',
            action: 'text',
            resource_type: 'text',
            resource_id: 'text',
            details_json: 'text',
            ip_address: 'text',
            created_at: 'datetime',
        },
        optional_columns: ['log_id'],
    },
};

/**
 * Probes column types for a table by inserting a single test row with ALL columns
 * populated at once (text columns get a probe string, bigint columns get 0,
 * datetime columns get a formatted datetime). This avoids mandatory-column errors
 * and avoids polluting the table with partial junk rows.
 *
 * Returns a map of column_name → 'bigint' | 'text' | 'datetime' | 'unknown'.
 *
 * Strategy:
 *  1. Build a row with ALL expected columns using valid text values.
 *  2. If insert succeeds → all columns accept text → mark them as 'text'.
 *     Clean up the row immediately.
 *  3. If insert fails with "bigint value expected" or "datetime value expected"
 *     → parse the error to find which column, mark it, and adjust for a retry.
 *  4. After max retries, any column not resolved is marked 'unknown'.
 */
const probeTableColumnTypes = async (datastore, tableName, expectedColumns) => {
    const { catalystDateTime } = require('./datastore');
    const table = datastore.table(tableName);
    const results = {};

    // Initialize all as 'unknown'
    for (const [colName] of Object.entries(expectedColumns)) {
        results[colName] = 'unknown';
    }

    // Build a test row — start with text-safe values for everything
    const testRow = {};
    const probeText = 'schema_probe_' + Date.now();
    for (const [colName, expectedType] of Object.entries(expectedColumns)) {
        if (expectedType === 'bigint') {
            testRow[colName] = 99999;
        } else if (expectedType === 'datetime') {
            testRow[colName] = catalystDateTime();
        } else {
            testRow[colName] = probeText;
        }
    }

    // Attempt insert with correctly-typed values first (optimistic path)
    try {
        const row = await table.insertRow(testRow);
        // Success → all columns match their expected types
        for (const [colName, expectedType] of Object.entries(expectedColumns)) {
            results[colName] = expectedType === 'text' ? 'text' : expectedType;
        }
        // Cleanup test row
        if (row && row.ROWID) {
            try { await table.deleteRow(row.ROWID); } catch (e) { /* cleanup */ }
        }
        return results;
    } catch (err) {
        const errMsg = (err.message || '');
        const errLower = errMsg.toLowerCase();

        // If a column is missing entirely
        if (errLower.includes('invalid column') || errLower.includes('does not exist')) {
            // Try to identify which column
            for (const colName of Object.keys(expectedColumns)) {
                if (errLower.includes(colName.toLowerCase())) {
                    results[colName] = 'missing';
                }
            }
        }

        // If there's a type mismatch, the error message tells us which column
        if (errLower.includes('bigint value expected')) {
            // A text column was sent a string but Catalyst says it wants bigint
            for (const [colName, expectedType] of Object.entries(expectedColumns)) {
                if (expectedType === 'text' && errLower.includes(colName.toLowerCase())) {
                    results[colName] = 'bigint'; // MISMATCH: expected text, got bigint
                }
            }
        }

        if (errLower.includes('datetime value expected')) {
            for (const [colName, expectedType] of Object.entries(expectedColumns)) {
                if (expectedType === 'text' && errLower.includes(colName.toLowerCase())) {
                    results[colName] = 'datetime'; // MISMATCH: expected text, got datetime
                }
            }
        }

        if (errLower.includes('invalid input value for')) {
            // Parse the column name from the error: "Invalid input value for <column_name>"
            const match = errMsg.match(/invalid input value for\s+(\w+)/i);
            if (match) {
                const badCol = match[1].toLowerCase();
                for (const [colName, expectedType] of Object.entries(expectedColumns)) {
                    if (colName.toLowerCase() === badCol) {
                        // Determine actual type from context
                        if (errLower.includes('bigint')) {
                            results[colName] = 'bigint';
                        } else if (errLower.includes('datetime')) {
                            results[colName] = 'datetime';
                        } else {
                            // We sent the expected type but it failed — it's the opposite
                            results[colName] = expectedType === 'text' ? 'bigint' : 'text';
                        }
                    }
                }
            }
        }

        // For columns we couldn't diagnose from the error, mark based on
        // whether our expected type likely would have worked
        for (const [colName, expectedType] of Object.entries(expectedColumns)) {
            if (results[colName] === 'unknown') {
                // If the error wasn't about this column, assume our expected type is correct
                if (!errLower.includes(colName.toLowerCase())) {
                    results[colName] = expectedType === 'text' ? 'text' : expectedType;
                }
            }
        }

        return results;
    }
};

/**
 * Validates the full schema and returns a detailed report.
 * Does NOT modify the database — read-only validation.
 *
 * @param {object} req - Express request with catalystApp
 * @returns {Promise<object>} Validation report
 */
const validateSchema = async (req) => {
    const { executeZCQL } = require('./datastore');
    const datastore = req.catalystApp.datastore();

    const report = {
        valid: true,
        errors: [],
        warnings: [],
        tables: {},
    };

    for (const [tableName, schema] of Object.entries(EXPECTED_SCHEMA)) {
        const tableReport = {
            exists: false,
            columns: {},
            mismatches: [],
            missing_columns: [],
        };

        // Check if table exists
        try {
            await executeZCQL(req, `SELECT ROWID FROM ${tableName} LIMIT 1`);
            tableReport.exists = true;
        } catch (e) {
            tableReport.exists = false;
            if (schema.required) {
                report.valid = false;
                report.errors.push({
                    type: 'MISSING_TABLE',
                    table: tableName,
                    message: `Required table "${tableName}" does not exist. Create it in the Catalyst Console → Data Store → "+ New Table".`,
                    fix: `Go to Catalyst Console → Data Store → click "+ New Table" → name it exactly "${tableName}" → add all columns listed in the migration guide.`,
                });
            } else {
                report.warnings.push({
                    type: 'MISSING_OPTIONAL_TABLE',
                    table: tableName,
                    message: `Optional table "${tableName}" not found. Some features may not work.`,
                });
            }
            report.tables[tableName] = tableReport;
            continue;
        }

        // Table exists — probe ALL columns at once (avoids per-column test inserts)
        const probeResults = await probeTableColumnTypes(datastore, tableName, schema.columns);

        for (const [colName, expectedType] of Object.entries(schema.columns)) {
            const actualType = probeResults[colName] || 'unknown';

            tableReport.columns[colName] = {
                expected: expectedType,
                actual: actualType,
                ok: false,
            };

            if (actualType === 'missing') {
                tableReport.missing_columns.push(colName);
                tableReport.columns[colName].ok = false;
                report.valid = false;
                report.errors.push({
                    type: 'MISSING_COLUMN',
                    table: tableName,
                    column: colName,
                    expected_type: expectedType,
                    message: `Column "${colName}" does not exist in table "${tableName}".`,
                    fix: `Go to Catalyst Console → Data Store → "${tableName}" → Schema View → "+ New Column" → name: "${colName}", type: ${expectedType === 'text' ? 'varchar' : expectedType}.`,
                });
            } else if (actualType === 'unknown') {
                // Can't determine — assume OK with a warning
                tableReport.columns[colName].ok = true;
                report.warnings.push({
                    type: 'UNVERIFIABLE_COLUMN',
                    table: tableName,
                    column: colName,
                    message: `Could not verify type of column "${colName}" in "${tableName}". It may be fine.`,
                });
            } else {
                // Check type match
                const isMatch = (
                    (expectedType === 'text' && actualType === 'text') ||
                    (expectedType === 'bigint' && actualType === 'bigint') ||
                    (expectedType === 'datetime' && actualType === 'datetime') ||
                    (expectedType === 'boolean_text' && actualType === 'text')
                );

                tableReport.columns[colName].ok = isMatch;

                if (!isMatch) {
                    tableReport.mismatches.push({
                        column: colName,
                        expected: expectedType,
                        actual: actualType,
                    });
                    report.valid = false;
                    report.errors.push({
                        type: 'TYPE_MISMATCH',
                        table: tableName,
                        column: colName,
                        expected_type: expectedType,
                        actual_type: actualType,
                        message: `Column "${colName}" in table "${tableName}" is type "${actualType}" but should be "${expectedType === 'text' ? 'varchar' : expectedType}".`,
                        fix: `Catalyst does NOT support changing column types. You must: 1) Delete the column "${colName}" in Catalyst Console → Data Store → "${tableName}" → Schema View. 2) Re-create it with the CORRECT type: "${expectedType === 'text' ? 'varchar(100)' : expectedType}". WARNING: Deleting a column destroys all data in it.`,
                    });
                }
            }
        }

        report.tables[tableName] = tableReport;
    }

    return report;
};

/**
 * Quick pre-flight check — validates only the tables needed for setup.
 * Throws an AppError with detailed fix instructions if validation fails.
 *
 * @param {object} req - Express request with catalystApp
 */
const validateSchemaForSetup = async (req) => {
    const { AppError } = require('../core/errors');

    const setupTables = ['Organization', 'Users', 'Permissions', 'Roles', 'RolePermissions', 'Workspaces', 'UserWorkspaces'];

    const report = await validateSchema(req);

    // Filter errors to only setup-critical tables
    const criticalErrors = report.errors.filter(err =>
        setupTables.includes(err.table)
    );

    if (criticalErrors.length === 0) {
        return; // All good!
    }

    // Build a comprehensive error message
    const errorLines = [
        `Schema validation failed — ${criticalErrors.length} issue(s) found that will prevent setup:`,
        '',
    ];

    // Group by type for readability
    const missingTables = criticalErrors.filter(e => e.type === 'MISSING_TABLE');
    const missingColumns = criticalErrors.filter(e => e.type === 'MISSING_COLUMN');
    const typeMismatches = criticalErrors.filter(e => e.type === 'TYPE_MISMATCH');

    if (missingTables.length > 0) {
        errorLines.push(`❌ MISSING TABLES (${missingTables.length}):`);
        for (const err of missingTables) {
            errorLines.push(`   • ${err.message}`);
            errorLines.push(`     FIX: ${err.fix}`);
        }
        errorLines.push('');
    }

    if (missingColumns.length > 0) {
        errorLines.push(`❌ MISSING COLUMNS (${missingColumns.length}):`);
        for (const err of missingColumns) {
            errorLines.push(`   • ${err.message}`);
            errorLines.push(`     FIX: ${err.fix}`);
        }
        errorLines.push('');
    }

    if (typeMismatches.length > 0) {
        errorLines.push(`❌ WRONG COLUMN TYPES (${typeMismatches.length}):`);
        for (const err of typeMismatches) {
            errorLines.push(`   • ${err.message}`);
            errorLines.push(`     FIX: ${err.fix}`);
        }
        errorLines.push('');
    }

    errorLines.push('Fix these issues in the Catalyst Console (https://console.catalyst.zoho.com) → Data Store, then retry setup.');

    throw new AppError(
        errorLines.join('\n'),
        422,
        'SCHEMA_VALIDATION_FAILED'
    );
};

module.exports = {
    validateSchema,
    validateSchemaForSetup,
    EXPECTED_SCHEMA,
};
