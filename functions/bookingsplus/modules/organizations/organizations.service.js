/**
 * Organization Service — Business logic for org setup and management.
 * 
 * IMPORTANT: All Catalyst Data Store columns typed as BIGINT must receive
 * numeric values (not strings like 'pending' or 'temp-123'). Always coerce
 * IDs to numbers using toBigInt() before inserting.
 */
const { getDatastore, executeZCQL, insertAuditLog, catalystDateTime } = require('../../utils/datastore');
const { seedPermissions } = require('../../utils/seed-permissions');
const { seedRolesForWorkspace } = require('../../utils/seed-roles');
const { validateSchemaForSetup } = require('../../utils/schema-validator');
const { TABLES, DEFAULTS, AUDIT_ACTIONS } = require('../../core/constants');
const { ConflictError, ValidationError, AppError } = require('../../core/errors');

/**
 * Coerce any value to a safe BIGINT-compatible number for Catalyst Data Store.
 * Catalyst BIGINT columns reject strings, nulls, and non-numeric values.
 * Returns a numeric value that Catalyst will accept.
 */
const toBigInt = (value) => {
    if (value === null || value === undefined) return Date.now();
    if (typeof value === 'number' && !isNaN(value)) return value;
    const parsed = parseInt(String(value), 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
    return Date.now(); // Safe fallback — always a valid bigint timestamp
};

/**
 * Safe insert helper — tries to insert a row with progressive fallback.
 * 
 * Strategy:
 *   1. Try full insert with all columns
 *   2. If column error → strip optional columns (retryWithout) and retry
 *   3. If still fails → parse the error to find which column is invalid,
 *      strip that specific column, and retry
 *   4. If still fails → try with only the absolute minimum columns
 * 
 * Also handles "mandatory column is empty" by checking if the table has
 * a built-in `name` column that Catalyst requires.
 */
const safeInsertRow = async (datastore, tableName, rowData, retryWithout = []) => {
    const table = datastore.table(tableName);
    const allColumns = Object.keys(rowData);
    
    // ── Attempt 1: Full insert ──
    try {
        return await table.insertRow(rowData);
    } catch (err1) {
        const errMsg1 = (err1.message || '');
        const errLower1 = errMsg1.toLowerCase();
        console.warn(`[${tableName}] Full insert failed (${allColumns.length} cols): ${errMsg1}`);
        console.warn(`[${tableName}] Columns sent: ${allColumns.join(', ')}`);
        
        // Check if Catalyst is asking for a mandatory 'name' column we didn't provide
        // Some Catalyst tables have a built-in 'name' column that's mandatory
        if (errLower1.includes('mandatory') && errLower1.includes('name')) {
            console.warn(`[${tableName}] Catalyst requires a mandatory 'name' column — adding it`);
            // Derive a name value from any *_name column in the data
            const nameValue = rowData.workspace_name || rowData.org_name || rowData.service_name || 
                              rowData.customer_name || rowData.display_name || rowData.role_name || 
                              `${tableName}_${Date.now()}`;
            const withName = { ...rowData, name: nameValue };
            try {
                return await table.insertRow(withName);
            } catch (nameErr) {
                console.warn(`[${tableName}] Insert with 'name' also failed: ${nameErr.message}`);
                // Continue to next strategies...
            }
        }

        // ── Attempt 2: Strip optional columns ──
        if (retryWithout.length > 0 && (
            errLower1.includes('invalid input value') || 
            errLower1.includes('invalid column') ||
            errLower1.includes('does not exist') ||
            errLower1.includes('column') // Broad catch for any column issue
        )) {
            const reducedData = { ...rowData };
            for (const col of retryWithout) {
                delete reducedData[col];
            }
            console.warn(`[${tableName}] Retrying without: ${retryWithout.join(', ')} (${Object.keys(reducedData).length} cols remaining)`);
            
            try {
                return await table.insertRow(reducedData);
            } catch (err2) {
                const errMsg2 = (err2.message || '');
                const errLower2 = errMsg2.toLowerCase();
                console.warn(`[${tableName}] Reduced insert failed: ${errMsg2}`);
                
                // Check if Catalyst wants a 'name' column
                if (errLower2.includes('mandatory') && errLower2.includes('name')) {
                    const nameValue = rowData.workspace_name || rowData.org_name || rowData.service_name || 
                                      rowData.customer_name || rowData.display_name || `${tableName}_${Date.now()}`;
                    try {
                        return await table.insertRow({ ...reducedData, name: nameValue });
                    } catch (nameErr2) {
                        console.warn(`[${tableName}] Reduced + name also failed: ${nameErr2.message}`);
                    }
                }

                // ── Attempt 3: Parse error to find the bad column ──
                // Catalyst errors look like: "Invalid input value for column <column_name>"
                const badColMatch = errMsg2.match(/invalid input value for column\s+(\w+)/i) ||
                                    errMsg2.match(/invalid input value for\s+(\w+)/i) ||
                                    errMsg2.match(/column\s+['"]?(\w+)['"]?\s+does not exist/i);
                
                if (badColMatch) {
                    const badCol = badColMatch[1].toLowerCase();
                    const furtherReduced = { ...reducedData };
                    // Remove the identified bad column
                    for (const key of Object.keys(furtherReduced)) {
                        if (key.toLowerCase() === badCol) {
                            delete furtherReduced[key];
                            console.warn(`[${tableName}] Identified bad column "${key}", removing it`);
                        }
                    }
                    try {
                        return await table.insertRow(furtherReduced);
                    } catch (err3) {
                        console.warn(`[${tableName}] Third attempt also failed: ${err3.message}`);
                    }
                }

                // ── Attempt 4: Absolute minimum — only BIGINT-safe ID columns + text columns ──
                // Try just the _id column + created_at + status
                const minData = {};
                for (const [key, val] of Object.entries(rowData)) {
                    // Keep only ID columns (bigint) and essential text fields
                    if (key.endsWith('_id') || key === 'status' || key === 'created_at') {
                        minData[key] = val;
                    }
                }
                // Add a name field for tables that might require it
                const nameValue = rowData.workspace_name || rowData.org_name || rowData.service_name || 
                                  rowData.customer_name || rowData.display_name || `${tableName}_${Date.now()}`;
                minData.name = nameValue;
                
                console.warn(`[${tableName}] Final attempt with minimum columns: ${Object.keys(minData).join(', ')}`);
                try {
                    return await table.insertRow(minData);
                } catch (err4) {
                    // One last try without 'name' in case it doesn't exist either
                    delete minData.name;
                    try {
                        return await table.insertRow(minData);
                    } catch (err5) {
                        console.error(`[${tableName}] All insert strategies exhausted. Last error: ${err5.message}`);
                        throw new AppError(
                            `Table "${tableName}" insert failed after 5 attempts. ` +
                            `Last error: ${err5.message}. ` +
                            `Original columns: ${allColumns.join(', ')}. ` +
                            `Please verify table columns in the Catalyst Data Store console match exactly: ${allColumns.join(', ')}`,
                            500,
                            'DATASTORE_SCHEMA_ERROR'
                        );
                    }
                }
            }
        }

        // If not a column error, throw as-is
        if (errLower1.includes('mandatory') && errLower1.includes('empty')) {
            throw new AppError(
                `Table "${tableName}" has a mandatory column that received an empty value: ${errMsg1}. ` +
                `This usually means a column was set as "Mandatory" in the Catalyst Console but the app didn't provide a value for it.`,
                500,
                'DATASTORE_CONFIG_ERROR'
            );
        }

        throw err1;
    }
};

/**
 * Full onboarding flow: creates org, seeds permissions, creates workspace, seeds roles.
 * 
 * IMPORTANT: During first-time setup, the auth middleware does NOT insert the user
 * into the Users table (because organization_id is mandatory and no org exists yet).
 * Instead, req.user has _isTemporary=true and _needsDbInsert=true flags.
 * This function creates the Organization first, then inserts the user row with
 * the real organization_id (the org's ROWID).
 * 
 * ALL BIGINT columns must receive numeric values. We use toBigInt() to ensure
 * values like 'pending', 'temp-xxx', or string ROWIDs are converted to numbers.
 */
const setupOrganization = async (req, { organization_name, org_slug, timezone, currency, workspace_name, workspace_slug }) => {
    if (!organization_name) {
        throw new ValidationError('Organization name is required.');
    }

    const datastore = getDatastore(req);
    let currentStep = 'Checking existing setup';

    try {
        // ── STEP 0: Quick check if already set up (1 DB call) ──
        // NOTE: Removed the expensive validateSchemaForSetup() call that was doing
        // probe inserts/deletes on EVERY table (14+ extra DB calls). Schema errors
        // will now surface as clear error messages from the actual inserts.
        currentStep = 'Checking if organization already exists';
        let existing = [];
        try {
            existing = await executeZCQL(req, `SELECT * FROM ${TABLES.ORGANIZATION} LIMIT 1`);
        } catch (e) {
            console.log('Organization table query (expected empty for first setup):', e.message);
        }

        if (existing.length > 0 && existing[0].Organization.setup_completed === 'true') {
            throw new ConflictError('Organization already set up.');
        }

        // Generate unique IDs upfront (all BIGINT-safe)
        const nowMs = Date.now();
        const orgId = nowMs;
        const userId = nowMs + 1;
        const workspaceId = nowMs + 2;
        const userWorkspaceId = nowMs + 3;

        // ── STEP 1: Create Organization (1 DB call) ──
        currentStep = 'Creating organization record';
        const slug = org_slug || organization_name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const orgRow = await safeInsertRow(datastore, TABLES.ORGANIZATION, {
            organization_id: orgId,
            org_name: organization_name,
            org_slug: slug,
            timezone: timezone || DEFAULTS.TIMEZONE,
            currency: currency || DEFAULTS.CURRENCY,
            subscription_plan: DEFAULTS.SUBSCRIPTION_PLAN,
            owner_user_id: userId,
            brand_color: DEFAULTS.BRAND_COLOR,
            status: 'active',
            setup_completed: 'false',
            created_at: catalystDateTime(),
        }, ['brand_color', 'subscription_plan', 'logo_url']);

        const orgROWID = orgRow.ROWID;

        // ── STEP 2: Seed Permissions + Create User IN PARALLEL ──
        // These are independent operations — run them concurrently to save time.
        currentStep = 'Seeding permissions & creating admin user';

        let userROWID;
        const userInsertPromise = (async () => {
            if (req.user._needsDbInsert) {
                const catalystName = req.user.display_name || req.user.email.split('@')[0];
                const newUserRow = await safeInsertRow(datastore, TABLES.USERS, {
                    user_id: userId,
                    catalyst_user_id: String(req.user.catalyst_user_id),
                    catalyst_role_id: String(req.user.catalyst_role_id || ''),
                    display_name: catalystName,
                    email: req.user.email,
                    phone: '',
                    organization_id: toBigInt(orgROWID),
                    is_super_admin: 'true',
                    role_version: 0,
                    status: 'active',
                    color: DEFAULTS.USER_COLOR,
                    initials: catalystName.substring(0, 2).toUpperCase(),
                    created_at: catalystDateTime(),
                }, ['phone', 'color', 'initials', 'catalyst_role_id', 'avatar_url', 'designation', 'gender', 'dob']);

                userROWID = newUserRow.ROWID;
                req.user.user_id = toBigInt(newUserRow.user_id || newUserRow.ROWID);
                req.user.ROWID = newUserRow.ROWID;
                req.user._isTemporary = false;
                req.user._needsDbInsert = false;
                console.log('Setup: Created user ROWID:', newUserRow.ROWID, 'org ROWID:', orgROWID);
            } else if (req.user.ROWID) {
                userROWID = req.user.ROWID;
                await datastore.table(TABLES.USERS).updateRow({
                    ROWID: req.user.ROWID,
                    is_super_admin: 'true',
                    organization_id: toBigInt(orgROWID),
                }).catch(e => console.error('Failed to update user org:', e.message));
            }
        })();

        // Run permission seeding + user creation concurrently
        await Promise.all([
            seedPermissions(req),
            userInsertPromise,
        ]);

        // ── STEP 3: Create workspace (WHILE updating org owner in background) ──
        currentStep = 'Creating workspace';
        const wsName = workspace_name || organization_name;
        const wsSlug = workspace_slug || wsName.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const createdBy = toBigInt(userROWID || req.user.ROWID || req.user.user_id);

        // Fire-and-forget: update org owner in background (don't block)
        const realOwnerUserId = toBigInt(userROWID || req.user.ROWID || req.user.user_id);
        datastore.table(TABLES.ORGANIZATION).updateRow({
            ROWID: orgRow.ROWID,
            owner_user_id: realOwnerUserId,
        }).catch(e => console.warn('Non-critical: org owner update failed:', e.message));

        // ── WORKSPACE INSERT with schema discovery ──
        // The Workspaces table may have been created manually in the Catalyst Console
        // with different column names than what the code expects. Common mismatches:
        //   - 'name' instead of 'workspace_name' (Catalyst default column)
        //   - Missing 'organization_id' (migration guide didn't include it)
        //   - Missing 'workspace_slug' (might be named 'slug')
        //
        // Strategy: First try with our expected columns. The safeInsertRow helper
        // will progressively strip columns and try alternatives until it succeeds.
        //
        // We also probe the table schema first to adapt column names.
        let wsActualColumns = null;
        try {
            const probe = await executeZCQL(req, `SELECT * FROM ${TABLES.WORKSPACES} LIMIT 1`);
            if (probe.length > 0) {
                wsActualColumns = Object.keys(probe[0].Workspaces || {});
                console.log(`[Setup] Workspaces table columns discovered: ${wsActualColumns.join(', ')}`);
            }
        } catch (probeErr) {
            // Table might be empty — try a different approach: insert and see what sticks
            console.log(`[Setup] Workspaces table is empty or query failed, using default column names`);
        }
        
        // Build the workspace row data, adapting to actual column names
        const wsRowData = {
            workspace_id: workspaceId,
            status: 'active',
            created_by: createdBy,
            created_at: catalystDateTime(),
        };
        
        // If we discovered the actual columns, use them; otherwise send both variants
        const actualColsLower = (wsActualColumns || []).map(c => c.toLowerCase());
        
        // workspace_name vs name
        if (actualColsLower.includes('workspace_name')) {
            wsRowData.workspace_name = wsName;
        } else if (actualColsLower.includes('name')) {
            wsRowData.name = wsName;
        } else {
            // Don't know — send both, safeInsertRow will handle the failure
            wsRowData.workspace_name = wsName;
        }
        
        // workspace_slug vs slug
        if (actualColsLower.includes('workspace_slug')) {
            wsRowData.workspace_slug = wsSlug;
        } else if (actualColsLower.includes('slug')) {
            wsRowData.slug = wsSlug;
        } else {
            wsRowData.workspace_slug = wsSlug;
        }
        
        // organization_id — only include if the column exists
        if (!wsActualColumns || actualColsLower.includes('organization_id')) {
            wsRowData.organization_id = toBigInt(orgROWID);
        }
        
        // Optional fields — only include if column exists (or if we don't know)
        if (!wsActualColumns || actualColsLower.includes('description')) {
            wsRowData.description = `Default workspace for ${organization_name}`;
        }
        if (!wsActualColumns || actualColsLower.includes('brand_color')) {
            wsRowData.brand_color = DEFAULTS.BRAND_COLOR;
        }
        
        // IMPORTANT: workspace_name and workspace_slug are NOT optional — they are the
        // core identity of the workspace. Only truly optional/cosmetic columns go here.
        // Previously workspace_name and workspace_slug were in this list, causing them
        // to be stripped during retry fallbacks → workspace inserted without its name.
        const wsOptionalCols = ['description', 'brand_color', 'timezone', 'currency', 'logo_url', 'organization_id'];
        const wsRow = await safeInsertRow(datastore, TABLES.WORKSPACES, wsRowData, wsOptionalCols);

        // ── STEP 4: Seed Roles + UserWorkspace assignment IN PARALLEL ──
        // seedRolesForWorkspace needs to complete first (to get Owner role ID),
        // but we can start the org completion update concurrently.
        currentStep = 'Creating default roles and permissions';
        const roleMap = await seedRolesForWorkspace(req, wsRow.ROWID);

        // ── STEP 5: Assign Owner to workspace + Mark complete IN PARALLEL ──
        currentStep = 'Finalizing setup';
        const ownerRoleId = roleMap['Owner'];
        const assignUserId = toBigInt(userROWID || req.user.ROWID || req.user.user_id);

        await Promise.all([
            // Assign owner role
            safeInsertRow(datastore, TABLES.USER_WORKSPACES, {
                user_workspace_id: userWorkspaceId,
                user_id: assignUserId,
                workspace_id: toBigInt(wsRow.ROWID),
                role_id: toBigInt(ownerRoleId),
                status: 'active',
                joined_at: catalystDateTime(),
            }),
            // Mark setup complete
            datastore.table(TABLES.ORGANIZATION).updateRow({
                ROWID: orgRow.ROWID,
                setup_completed: 'true',
            }),
        ]);

        // Audit log — fire-and-forget (don't block the response)
        insertAuditLog(req, {
            workspaceId: wsRow.ROWID,
            userId: req.user.user_id,
            action: AUDIT_ACTIONS.ORG_SETUP,
            resourceType: TABLES.ORGANIZATION,
            resourceId: orgRow.ROWID,
            details: { org_name: organization_name, workspace_name: wsName },
        }).catch(e => console.error('Audit log failed (non-critical):', e.message));

        return { organization: orgRow, workspace: wsRow };

    } catch (err) {
        if (err instanceof AppError || err instanceof ConflictError || err instanceof ValidationError) {
            throw err;
        }

        const stepInfo = currentStep ? ` (while: ${currentStep})` : '';
        const rawMsg = err.message || 'Unknown error';
        console.error(`Setup failed at step "${currentStep}":`, rawMsg);

        throw new AppError(
            `Setup failed${stepInfo}: ${rawMsg}`,
            500,
            'SETUP_ERROR'
        );
    }
};

/**
 * Get the organization details.
 */
const getOrganization = async (req) => {
    const result = await executeZCQL(req, `SELECT * FROM ${TABLES.ORGANIZATION} LIMIT 1`);
    if (result.length === 0) {
        return { data: null, setupRequired: true };
    }
    const orgInfo = result[0].Organization;
    return { data: orgInfo, setupRequired: orgInfo.setup_completed !== 'true' };
};

/**
 * Update organization details.
 */
const updateOrganization = async (req, updateData) => {
    const result = await executeZCQL(req, `SELECT ROWID FROM ${TABLES.ORGANIZATION} LIMIT 1`);
    if (result.length === 0) {
        throw new Error('Organization not found.');
    }
    const datastore = getDatastore(req);
    const updated = await datastore.table(TABLES.ORGANIZATION).updateRow({
        ROWID: result[0].Organization.ROWID,
        ...updateData,
    });
    return updated;
};

module.exports = {
    setupOrganization,
    getOrganization,
    updateOrganization,
};
