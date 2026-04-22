/**
 * Organization Service — Business logic for org setup and management.
 */
const { getDatastore, executeZCQL, insertAuditLog } = require('../../utils/datastore');
const { seedPermissions } = require('../../utils/seed-permissions');
const { seedRolesForWorkspace } = require('../../utils/seed-roles');
const { TABLES, DEFAULTS, AUDIT_ACTIONS } = require('../../core/constants');
const { ConflictError, ValidationError } = require('../../core/errors');

/**
 * Full onboarding flow: creates org, seeds permissions, creates workspace, seeds roles.
 */
const setupOrganization = async (req, { organization_name, org_slug, timezone, currency, workspace_name, workspace_slug }) => {
    if (!organization_name) {
        throw new ValidationError('Organization name is required.');
    }

    const datastore = getDatastore(req);

    // Check if already set up
    let existing = [];
    try {
        existing = await executeZCQL(req, `SELECT * FROM ${TABLES.ORGANIZATION} LIMIT 1`);
    } catch (e) { /* table might not exist yet */ }

    if (existing.length > 0 && existing[0].Organization.setup_completed === 'true') {
        throw new ConflictError('Organization already set up.');
    }

    // 1. Create Organization
    const slug = org_slug || organization_name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const orgRow = await datastore.table(TABLES.ORGANIZATION).insertRow({
        organization_id: Date.now(),
        org_name: organization_name,
        org_slug: slug,
        timezone: timezone || DEFAULTS.TIMEZONE,
        currency: currency || DEFAULTS.CURRENCY,
        subscription_plan: DEFAULTS.SUBSCRIPTION_PLAN,
        owner_user_id: req.user.user_id || req.user.ROWID,
        brand_color: DEFAULTS.BRAND_COLOR,
        status: 'active',
        setup_completed: 'false',
        created_at: new Date().toISOString(),
    });

    // 2. Seed Permissions
    await seedPermissions(req);

    // 3. Ensure current user is Super Admin
    if (req.user.ROWID) {
        await datastore.table(TABLES.USERS).updateRow({
            ROWID: req.user.ROWID,
            is_super_admin: 'true',
        });
    }

    // 4. Create first Workspace
    const wsName = workspace_name || organization_name;
    const wsSlug = workspace_slug || wsName.toLowerCase().replace(/[^a-z0-9]/g, '-');

    const wsRow = await datastore.table(TABLES.WORKSPACES).insertRow({
        workspace_id: Date.now() + 1,
        workspace_name: wsName,
        workspace_slug: wsSlug,
        description: `Default workspace for ${organization_name}`,
        brand_color: DEFAULTS.BRAND_COLOR,
        status: 'active',
        created_by: req.user.user_id || req.user.ROWID,
        created_at: new Date().toISOString(),
    });

    // 5. Seed Roles
    const roleMap = await seedRolesForWorkspace(req, wsRow.ROWID);

    // 6. Assign Owner
    const ownerRoleId = roleMap['Owner'];
    await datastore.table(TABLES.USER_WORKSPACES).insertRow({
        user_workspace_id: Date.now() + 2,
        user_id: req.user.user_id || req.user.ROWID,
        workspace_id: wsRow.ROWID,
        role_id: ownerRoleId,
        status: 'active',
        joined_at: new Date().toISOString(),
    });

    // 7. Mark complete
    await datastore.table(TABLES.ORGANIZATION).updateRow({
        ROWID: orgRow.ROWID,
        setup_completed: 'true',
    });

    // 8. Audit
    await insertAuditLog(req, {
        workspaceId: wsRow.ROWID,
        userId: req.user.user_id,
        action: AUDIT_ACTIONS.ORG_SETUP,
        resourceType: TABLES.ORGANIZATION,
        resourceId: orgRow.ROWID,
        details: { org_name: organization_name, workspace_name: wsName },
    });

    return { organization: orgRow, workspace: wsRow };
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
