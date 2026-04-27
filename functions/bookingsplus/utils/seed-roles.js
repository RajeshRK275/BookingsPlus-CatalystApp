/**
 * Creates default roles + role-permission mappings for a new workspace.
 * Called when a workspace is created.
 * Creates: Owner (99), Admin (50), Manager (10), Staff (0)
 * 
 * IMPORTANT: All _id columns are BIGINT. workspace_id, role_id, permission_id
 * must all be numeric values, never strings.
 *
 * Column type reference for Roles table:
 *   role_id      → bigint
 *   workspace_id → bigint
 *   role_name    → varchar(100)
 *   role_level   → bigint
 *   is_system    → varchar(10)
 *   description  → varchar(255)
 *
 * Column type reference for RolePermissions table:
 *   role_perm_id   → bigint
 *   role_id        → bigint
 *   permission_id  → bigint
 */

const ROLE_TEMPLATES = [
    {
        role_name: 'Owner',
        role_level: 99,
        is_system: 'true',
        description: 'Full access to all features and settings',
        permissions: 'ALL', // All 25 permissions
    },
    {
        role_name: 'Admin',
        role_level: 50,
        is_system: 'true',
        description: 'Manage services, staff, and bookings',
        permissions: [
            'dashboard.read', 'services.create', 'services.read', 'services.update', 'services.delete',
            'appointments.create', 'appointments.read', 'appointments.update', 'appointments.delete', 'appointments.approve',
            'users.create', 'users.read', 'users.update', 'users.delete',
            'customers.create', 'customers.read', 'customers.update', 'customers.delete',
            'settings.read', 'settings.update', 'integrations.manage',
            'reports.read', 'reports.export', 'audit.read'
        ],
    },
    {
        role_name: 'Manager',
        role_level: 10,
        is_system: 'false',
        description: 'Manage team schedules and view reports',
        permissions: [
            'dashboard.read', 'services.create', 'services.read', 'services.update',
            'appointments.create', 'appointments.read', 'appointments.update', 'appointments.approve',
            'users.read',
            'customers.create', 'customers.read', 'customers.update',
            'settings.read', 'reports.read'
        ],
    },
    {
        role_name: 'Staff',
        role_level: 0,
        is_system: 'false',
        description: 'View own schedule and manage assigned bookings',
        permissions: [
            'dashboard.read', 'services.read',
            'appointments.read', 'appointments.create',
            'customers.read'
        ],
    },
];

/**
 * Seeds default roles for a workspace and assigns permissions.
 * @param {object} req - Express request with catalystApp
 * @param {string|number} workspaceId - The workspace to seed roles for
 * @returns {object} - Map of role_name to role_id (ROWID)
 */
const seedRolesForWorkspace = async (req, workspaceId) => {
    const { getDatastore, executeZCQL } = require('./datastore');
    const { AppError } = require('../core/errors');
    const datastore = getDatastore(req);

    /** Coerce to numeric BIGINT */
    const toBigInt = (val) => {
        if (typeof val === 'number' && !isNaN(val)) return val;
        const p = parseInt(String(val), 10);
        return (!isNaN(p) && p > 0) ? p : Date.now();
    };

    const wsId = toBigInt(workspaceId);

    // Fetch all permission rows from the Permissions table
    let allPerms = [];
    try {
        const allPermsResult = await executeZCQL(req, 'SELECT * FROM Permissions');
        allPerms = allPermsResult.map(r => r.Permissions);
    } catch (e) {
        console.error('Failed to query Permissions table:', e.message);
        throw new AppError(
            `Cannot seed roles: Failed to read Permissions table. ${e.message}`,
            500,
            'PERMISSIONS_READ_ERROR'
        );
    }

    if (allPerms.length === 0) {
        throw new AppError(
            'Cannot seed roles: Permissions table is empty. Permissions must be seeded first.',
            500,
            'PERMISSIONS_EMPTY'
        );
    }

    // Build permission_key → ROWID mapping
    const permKeyToId = {};
    allPerms.forEach(p => {
        permKeyToId[p.permission_key] = toBigInt(p.ROWID);
    });

    const roleTable = datastore.table('Roles');
    const rolePermTable = datastore.table('RolePermissions');
    const roleMap = {}; // role_name → ROWID

    // Use a single base timestamp + large offset to guarantee unique BIGINT IDs
    const roleBaseTs = Date.now();

    for (let i = 0; i < ROLE_TEMPLATES.length; i++) {
        const tmpl = ROLE_TEMPLATES[i];
        const roleId = roleBaseTs + (i + 1) * 10000;

        let roleRow;
        try {
            roleRow = await roleTable.insertRow({
                role_id: roleId,
                workspace_id: wsId,
                role_name: tmpl.role_name,
                role_level: tmpl.role_level,
                is_system: tmpl.is_system,
                description: tmpl.description,
            });
        } catch (err) {
            const errMsg = (err.message || '').toLowerCase();
            if (errMsg.includes('bigint value expected') || errMsg.includes('invalid input value')) {
                // Detect which column has wrong type
                let wrongCol = 'unknown';
                for (const col of ['role_name', 'is_system', 'description']) {
                    if (err.message.toLowerCase().includes(col)) {
                        wrongCol = col;
                        break;
                    }
                }
                throw new AppError(
                    `SCHEMA ERROR in "Roles" table: Column "${wrongCol}" is BIGINT but must be VARCHAR.\n\n` +
                    `TO FIX: Go to Catalyst Console → Data Store → "Roles" → Schema View.\n` +
                    `Delete "${wrongCol}" and re-create as varchar.\n\n` +
                    `Correct types: role_id(bigint), workspace_id(bigint), role_name(varchar), role_level(bigint), is_system(varchar), description(varchar)\n\n` +
                    `Original: ${err.message}`,
                    422,
                    'SCHEMA_TYPE_MISMATCH'
                );
            }
            throw err;
        }

        const insertedRoleId = toBigInt(roleRow.ROWID);
        roleMap[tmpl.role_name] = insertedRoleId;

        // Determine which permissions to assign
        let permKeys;
        if (tmpl.permissions === 'ALL') {
            permKeys = Object.keys(permKeyToId);
        } else {
            permKeys = tmpl.permissions;
        }

        // Insert RolePermissions rows — all _id columns are BIGINT
        // Use a unique base timestamp per role to avoid collisions across roles
        const rpBaseTs = Date.now() + (i + 1) * 100000;
        for (let j = 0; j < permKeys.length; j++) {
            const permId = permKeyToId[permKeys[j]];
            if (permId) {
                try {
                    await rolePermTable.insertRow({
                        role_perm_id: rpBaseTs + j,
                        role_id: insertedRoleId,
                        permission_id: permId,
                    });
                } catch (rpErr) {
                    console.error(`Failed to assign permission "${permKeys[j]}" to role "${tmpl.role_name}":`, rpErr.message);
                    // Don't fail the entire setup for a single permission assignment
                }
            } else {
                console.warn(`Permission key "${permKeys[j]}" not found in Permissions table — skipping assignment.`);
            }
        }
    }

    console.log(`Seeded ${ROLE_TEMPLATES.length} roles for workspace ${workspaceId}`);
    return roleMap;
};

module.exports = { seedRolesForWorkspace, ROLE_TEMPLATES };
