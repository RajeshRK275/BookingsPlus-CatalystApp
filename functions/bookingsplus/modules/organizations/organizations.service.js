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
 * Safe insert helper — tries to insert a row, and on column-name errors,
 * retries with progressively fewer columns. Provides actionable error messages.
 */
const safeInsertRow = async (datastore, tableName, rowData, retryWithout = []) => {
    try {
        return await datastore.table(tableName).insertRow(rowData);
    } catch (err) {
        const errMsg = (err.message || '').toLowerCase();

        // If there are optional columns to retry without, try stripping them
        if (retryWithout.length > 0 && (
            errMsg.includes('invalid input value') || 
            errMsg.includes('invalid column') ||
            errMsg.includes('does not exist')
        )) {
            console.warn(`[${tableName}] Insert failed, retrying without optional columns: ${retryWithout.join(', ')}. Error: ${err.message}`);
            const reducedData = { ...rowData };
            for (const col of retryWithout) {
                delete reducedData[col];
            }
            try {
                return await datastore.table(tableName).insertRow(reducedData);
            } catch (retryErr) {
                console.error(`[${tableName}] Retry also failed:`, retryErr.message);
                throw new AppError(
                    `Table "${tableName}" insert failed even with reduced columns. Error: ${retryErr.message}. Columns attempted: ${Object.keys(reducedData).join(', ')}`,
                    500,
                    'DATASTORE_SCHEMA_ERROR'
                );
            }
        }

        if (errMsg.includes('invalid input value') || errMsg.includes('invalid column')) {
            console.error(`[${tableName}] Insert failed — column mismatch. Error: ${err.message}`);
            console.error(`[${tableName}] Attempted columns & types: ${JSON.stringify(Object.entries(rowData).map(([k,v]) => `${k}=${typeof v}:${v}`))}`);
            throw new AppError(
                `Table "${tableName}" column error: ${err.message}. Columns attempted: ${Object.keys(rowData).join(', ')}. Please verify all columns exist and have correct types in the Catalyst Data Store console.`,
                500,
                'DATASTORE_SCHEMA_ERROR'
            );
        }

        if (errMsg.includes('mandatory') && errMsg.includes('empty')) {
            throw new AppError(
                `Table "${tableName}" has a mandatory column that received an empty value: ${err.message}`,
                500,
                'DATASTORE_CONFIG_ERROR'
            );
        }

        throw err;
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
        // ── STEP 0: Schema Validation ──
        // Validates all required tables and column types BEFORE attempting any inserts.
        // This catches issues like "permission_key is bigint but should be varchar"
        // and gives the user clear fix instructions instead of cryptic insert errors.
        currentStep = 'Validating Data Store schema';
        await validateSchemaForSetup(req);

        // Check if already set up
        currentStep = 'Checking if organization already exists';
        let existing = [];
        try {
            existing = await executeZCQL(req, `SELECT * FROM ${TABLES.ORGANIZATION} LIMIT 1`);
        } catch (e) {
            // Table might be empty — that's fine, means first-time setup
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

        // 1. Create Organization
        // owner_user_id is BIGINT — must be a number, NOT 'pending' or 'temp-xxx'
        // We use a placeholder numeric ID now and update it after user creation
        currentStep = 'Creating organization record';
        const slug = org_slug || organization_name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const orgRow = await safeInsertRow(datastore, TABLES.ORGANIZATION, {
            organization_id: orgId,
            org_name: organization_name,
            org_slug: slug,
            timezone: timezone || DEFAULTS.TIMEZONE,
            currency: currency || DEFAULTS.CURRENCY,
            subscription_plan: DEFAULTS.SUBSCRIPTION_PLAN,
            owner_user_id: userId, // Placeholder numeric — will update after user insert
            brand_color: DEFAULTS.BRAND_COLOR,
            status: 'active',
            setup_completed: 'false',
            created_at: catalystDateTime(),
        }, ['brand_color', 'subscription_plan', 'logo_url']);

        const orgROWID = orgRow.ROWID; // This is a number from Catalyst

        // 2. Seed Permissions
        currentStep = 'Seeding permission definitions';
        await seedPermissions(req);

        // 3. Create / link the setup user in the Users table
        currentStep = 'Creating admin user record';
        let userROWID;
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
            console.log('Setup: Created user row ROWID:', newUserRow.ROWID, 'org ROWID:', orgROWID);
        } else if (req.user.ROWID) {
            userROWID = req.user.ROWID;
            try {
                await datastore.table(TABLES.USERS).updateRow({
                    ROWID: req.user.ROWID,
                    is_super_admin: 'true',
                    organization_id: toBigInt(orgROWID),
                });
                console.log('Setup: Updated existing user row with organization_id:', orgROWID);
            } catch (updateErr) {
                console.error('Failed to update user with organization_id:', updateErr.message);
            }
        }

        // Update the org's owner_user_id to the real user ROWID
        currentStep = 'Linking organization owner';
        try {
            const realOwnerUserId = toBigInt(userROWID || req.user.ROWID || req.user.user_id);
            await datastore.table(TABLES.ORGANIZATION).updateRow({
                ROWID: orgRow.ROWID,
                owner_user_id: realOwnerUserId,
            });
        } catch (ownerUpdateErr) {
            console.warn('Failed to update org owner_user_id (non-critical):', ownerUpdateErr.message);
        }

        // 4. Create first Workspace
        currentStep = 'Creating first workspace';
        const wsName = workspace_name || organization_name;
        const wsSlug = workspace_slug || wsName.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const createdBy = toBigInt(userROWID || req.user.ROWID || req.user.user_id);

        const wsRow = await safeInsertRow(datastore, TABLES.WORKSPACES, {
            workspace_id: workspaceId,
            workspace_name: wsName,
            workspace_slug: wsSlug,
            description: `Default workspace for ${organization_name}`,
            brand_color: DEFAULTS.BRAND_COLOR,
            status: 'active',
            created_by: createdBy,
            created_at: catalystDateTime(),
        }, ['description', 'brand_color', 'timezone', 'currency', 'logo_url']);

        // 5. Seed Roles
        currentStep = 'Creating default roles and permissions';
        const roleMap = await seedRolesForWorkspace(req, wsRow.ROWID);

        // 6. Assign Owner to workspace
        currentStep = 'Assigning owner role to your account';
        const ownerRoleId = roleMap['Owner'];
        const assignUserId = toBigInt(userROWID || req.user.ROWID || req.user.user_id);
        await safeInsertRow(datastore, TABLES.USER_WORKSPACES, {
            user_workspace_id: userWorkspaceId,
            user_id: assignUserId,
            workspace_id: toBigInt(wsRow.ROWID),
            role_id: toBigInt(ownerRoleId),
            status: 'active',
            joined_at: catalystDateTime(),
        });

        // 7. Mark complete
        currentStep = 'Finalizing setup';
        await datastore.table(TABLES.ORGANIZATION).updateRow({
            ROWID: orgRow.ROWID,
            setup_completed: 'true',
        });

        // 8. Audit (non-blocking — don't let audit failure break setup)
        try {
            await insertAuditLog(req, {
                workspaceId: wsRow.ROWID,
                userId: req.user.user_id,
                action: AUDIT_ACTIONS.ORG_SETUP,
                resourceType: TABLES.ORGANIZATION,
                resourceId: orgRow.ROWID,
                details: { org_name: organization_name, workspace_name: wsName },
            });
        } catch (auditErr) {
            console.error('Audit log insert failed (non-critical):', auditErr.message);
        }

        return { organization: orgRow, workspace: wsRow };

    } catch (err) {
        // If it's already a known error type, re-throw as-is
        if (err instanceof AppError || err instanceof ConflictError || err instanceof ValidationError) {
            throw err;
        }

        // Wrap the raw error with step context so the user knows WHAT failed
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
