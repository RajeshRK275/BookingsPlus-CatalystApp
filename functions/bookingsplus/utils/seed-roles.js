/**
 * Creates default roles + role-permission mappings for a new workspace.
 * Called when a workspace is created.
 * Creates: Owner (99), Admin (50), Manager (10), Staff (0)
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
 * @returns {object} - Map of role_name to role_id
 */
const seedRolesForWorkspace = async (req, workspaceId) => {
    const { getDatastore, executeZCQL } = require('./datastore');
    const datastore = getDatastore(req);

    // Fetch all permission rows from the Permissions table
    const allPermsResult = await executeZCQL(req, 'SELECT * FROM Permissions');
    const allPerms = allPermsResult.map(r => r.Permissions);
    const permKeyToId = {};
    allPerms.forEach(p => {
        permKeyToId[p.permission_key] = p.ROWID;
    });

    const roleTable = datastore.table('Roles');
    const rolePermTable = datastore.table('RolePermissions');
    const roleMap = {}; // role_name → ROWID

    for (let i = 0; i < ROLE_TEMPLATES.length; i++) {
        const tmpl = ROLE_TEMPLATES[i];
        const roleId = Date.now() + i * 100;

        const roleRow = await roleTable.insertRow({
            role_id: roleId,
            workspace_id: workspaceId,
            role_name: tmpl.role_name,
            role_level: tmpl.role_level,
            is_system: tmpl.is_system,
            description: tmpl.description,
        });

        const insertedRoleId = roleRow.ROWID;
        roleMap[tmpl.role_name] = insertedRoleId;

        // Determine which permissions to assign
        let permKeys;
        if (tmpl.permissions === 'ALL') {
            permKeys = Object.keys(permKeyToId);
        } else {
            permKeys = tmpl.permissions;
        }

        // Insert RolePermissions rows
        for (let j = 0; j < permKeys.length; j++) {
            const permId = permKeyToId[permKeys[j]];
            if (permId) {
                await rolePermTable.insertRow({
                    role_perm_id: Date.now() + i * 1000 + j,
                    role_id: insertedRoleId,
                    permission_id: permId,
                });
            }
        }
    }

    console.log(`Seeded ${ROLE_TEMPLATES.length} roles for workspace ${workspaceId}`);
    return roleMap;
};

module.exports = { seedRolesForWorkspace, ROLE_TEMPLATES };
