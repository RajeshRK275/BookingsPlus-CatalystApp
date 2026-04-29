/**
 * Creates default roles + role-permission mappings for a new workspace.
 * Called when a workspace is created.
 * Creates: Owner (99), Admin (50), Manager (10), Staff (0)
 * 
 * PERFORMANCE: Uses bulk insertRows() for both Roles and RolePermissions.
 * - 4 roles inserted in 1 API call (was 4 individual calls)
 * - ~68 RolePermissions inserted in 1 API call (was 68 individual calls)
 * Total: 3 DB calls (1 read + 1 roles insert + 1 perms insert) vs 73+
 */

const ROLE_TEMPLATES = [
    {
        role_name: 'Owner',
        role_level: 99,
        is_system: 'true',
        description: 'Full access to all features and settings',
        permissions: 'ALL',
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

const seedRolesForWorkspace = async (req, workspaceId) => {
    const { getDatastore, executeZCQL } = require('./datastore');
    const { AppError } = require('../core/errors');
    const datastore = getDatastore(req);

    const toBigInt = (val) => {
        if (typeof val === 'number' && !isNaN(val)) return val;
        const p = parseInt(String(val), 10);
        return (!isNaN(p) && p > 0) ? p : Date.now();
    };

    const wsId = toBigInt(workspaceId);

    // Step 1: Fetch all permissions (1 DB call)
    let allPerms = [];
    try {
        const allPermsResult = await executeZCQL(req, 'SELECT * FROM Permissions');
        allPerms = allPermsResult.map(r => r.Permissions);
    } catch (e) {
        console.error('Failed to query Permissions table:', e.message);
        throw new AppError(`Cannot seed roles: Failed to read Permissions table. ${e.message}`, 500, 'PERMISSIONS_READ_ERROR');
    }

    if (allPerms.length === 0) {
        throw new AppError('Cannot seed roles: Permissions table is empty.', 500, 'PERMISSIONS_EMPTY');
    }

    const permKeyToId = {};
    allPerms.forEach(p => { permKeyToId[p.permission_key] = toBigInt(p.ROWID); });

    const roleTable = datastore.table('Roles');
    const rolePermTable = datastore.table('RolePermissions');
    const roleMap = {};

    // Step 2: Bulk insert ALL 4 roles at once (1 DB call)
    const roleBaseTs = Date.now();
    const roleRows = ROLE_TEMPLATES.map((tmpl, i) => ({
        role_id: roleBaseTs + (i + 1) * 10000,
        workspace_id: wsId,
        role_name: tmpl.role_name,
        role_level: tmpl.role_level,
        is_system: tmpl.is_system,
        description: tmpl.description,
    }));

    let insertedRoles;
    try {
        insertedRoles = await roleTable.insertRows(roleRows);
        console.log(`Bulk-inserted ${insertedRoles.length} roles for workspace ${workspaceId}`);
    } catch (err) {
        const errMsg = (err.message || '').toLowerCase();
        if (errMsg.includes('bigint value expected') || errMsg.includes('invalid input value')) {
            throw new AppError(
                `SCHEMA ERROR in "Roles" table: A text column is BIGINT but must be VARCHAR.\n` +
                `Correct types: role_id(bigint), workspace_id(bigint), role_name(varchar), role_level(bigint), is_system(varchar), description(varchar)\n` +
                `Original: ${err.message}`,
                422, 'SCHEMA_TYPE_MISMATCH'
            );
        }
        throw err;
    }

    for (let i = 0; i < ROLE_TEMPLATES.length; i++) {
        roleMap[ROLE_TEMPLATES[i].role_name] = toBigInt(insertedRoles[i].ROWID);
    }

    // Step 3: Build ALL RolePermission rows for ALL roles, then bulk insert (1 DB call)
    const allRolePermRows = [];
    const rpBaseTs = Date.now();
    let rpIndex = 0;

    for (let i = 0; i < ROLE_TEMPLATES.length; i++) {
        const tmpl = ROLE_TEMPLATES[i];
        const insertedRoleId = roleMap[tmpl.role_name];
        const permKeys = tmpl.permissions === 'ALL' ? Object.keys(permKeyToId) : tmpl.permissions;

        for (const permKey of permKeys) {
            const permId = permKeyToId[permKey];
            if (permId) {
                allRolePermRows.push({
                    role_perm_id: rpBaseTs + rpIndex + 1,
                    role_id: insertedRoleId,
                    permission_id: permId,
                });
                rpIndex++;
            }
        }
    }

    if (allRolePermRows.length > 0) {
        // Catalyst Data Store has a limit on bulk insert size.
        // Split into batches of 50 rows to be safe, and process batches in parallel
        // (2 concurrent batches at a time to avoid overwhelming the API).
        const BATCH_SIZE = 50;
        const batches = [];
        for (let i = 0; i < allRolePermRows.length; i += BATCH_SIZE) {
            batches.push(allRolePermRows.slice(i, i + BATCH_SIZE));
        }

        try {
            if (batches.length === 1) {
                // Single batch — just insert directly
                await rolePermTable.insertRows(batches[0]);
            } else {
                // Multiple batches — run 2 concurrently for speed
                const CONCURRENCY = 2;
                for (let i = 0; i < batches.length; i += CONCURRENCY) {
                    const concurrent = batches.slice(i, i + CONCURRENCY);
                    await Promise.all(concurrent.map(batch => rolePermTable.insertRows(batch)));
                }
            }
            console.log(`Bulk-inserted ${allRolePermRows.length} RolePermission rows in ${batches.length} batch(es).`);
        } catch (rpErr) {
            console.warn('Batch RolePermissions insert failed, trying individual:', rpErr.message);
            let successCount = 0;
            for (const row of allRolePermRows) {
                try { await rolePermTable.insertRow(row); successCount++; } catch (e) { /* skip */ }
            }
            console.log(`Fallback: Inserted ${successCount}/${allRolePermRows.length} RolePermissions individually.`);
        }
    }

    console.log(`Seeded ${ROLE_TEMPLATES.length} roles with ${allRolePermRows.length} permission assignments for workspace ${workspaceId}`);
    return roleMap;
};

module.exports = { seedRolesForWorkspace, ROLE_TEMPLATES };
