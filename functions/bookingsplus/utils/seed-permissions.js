/**
 * Seeds the Permissions table with all granular permission definitions.
 * Called once during organization setup (/setup endpoint).
 * Idempotent — checks if permissions already exist before inserting.
 *
 * IMPORTANT: The Permissions table columns MUST have these exact types:
 *   - permission_id   → bigint
 *   - permission_key  → varchar(100)  ← NOT bigint!
 *   - resource        → varchar(50)
 *   - action          → varchar(50)
 *   - description     → varchar(255)
 *
 * If any varchar column is incorrectly created as bigint in the Catalyst
 * Console, inserts will fail with "bigint value expected". To fix:
 * Delete the column in the Console and re-create it with the correct type.
 */

const PERMISSION_DEFINITIONS = [
    { key: 'dashboard.read', resource: 'dashboard', action: 'read', desc: 'View dashboard metrics and charts' },
    { key: 'services.create', resource: 'services', action: 'create', desc: 'Create new services/event types' },
    { key: 'services.read', resource: 'services', action: 'read', desc: 'View services list and details' },
    { key: 'services.update', resource: 'services', action: 'update', desc: 'Edit service configuration' },
    { key: 'services.delete', resource: 'services', action: 'delete', desc: 'Delete/archive services' },
    { key: 'appointments.create', resource: 'appointments', action: 'create', desc: 'Book/create appointments' },
    { key: 'appointments.read', resource: 'appointments', action: 'read', desc: 'View appointments list and details' },
    { key: 'appointments.update', resource: 'appointments', action: 'update', desc: 'Edit, reschedule appointments' },
    { key: 'appointments.delete', resource: 'appointments', action: 'delete', desc: 'Cancel/delete appointments' },
    { key: 'appointments.approve', resource: 'appointments', action: 'approve', desc: 'Approve pending appointment requests' },
    { key: 'users.create', resource: 'users', action: 'create', desc: 'Invite/add employees to workspace' },
    { key: 'users.read', resource: 'users', action: 'read', desc: 'View employee list and profiles' },
    { key: 'users.update', resource: 'users', action: 'update', desc: 'Edit employee profiles and details' },
    { key: 'users.delete', resource: 'users', action: 'delete', desc: 'Remove employees from workspace' },
    { key: 'customers.create', resource: 'customers', action: 'create', desc: 'Add new customers' },
    { key: 'customers.read', resource: 'customers', action: 'read', desc: 'View customer list and details' },
    { key: 'customers.update', resource: 'customers', action: 'update', desc: 'Edit customer information' },
    { key: 'customers.delete', resource: 'customers', action: 'delete', desc: 'Delete customer records' },
    { key: 'settings.read', resource: 'settings', action: 'read', desc: 'View workspace settings' },
    { key: 'settings.update', resource: 'settings', action: 'update', desc: 'Modify workspace settings' },
    { key: 'integrations.manage', resource: 'integrations', action: 'manage', desc: 'Connect/disconnect integrations' },
    { key: 'reports.read', resource: 'reports', action: 'read', desc: 'View reports and analytics' },
    { key: 'reports.export', resource: 'reports', action: 'export', desc: 'Export data to CSV/PDF' },
    { key: 'roles.manage', resource: 'roles', action: 'manage', desc: 'Create/edit/delete roles within workspace' },
    { key: 'audit.read', resource: 'audit', action: 'read', desc: 'View audit log entries' },
];

const seedPermissions = async (req) => {
    const { getDatastore, executeZCQL } = require('./datastore');

    // Check if permissions are already seeded
    let count = 0;
    try {
        const existing = await executeZCQL(req, 'SELECT COUNT(ROWID) as cnt FROM Permissions');
        count = parseInt(existing[0]?.Permissions?.cnt || 0);
    } catch (e) {
        // Table might be empty or query fails — proceed with seeding
        console.log('Permissions count check:', e.message);
    }

    if (count > 0) {
        console.log(`Permissions already seeded (${count} found). Skipping.`);
        return;
    }

    const datastore = getDatastore(req);
    const table = datastore.table('Permissions');

    // Use base timestamp + offset to guarantee unique BIGINT IDs
    const baseTs = Date.now();

    // ── Insert first permission with detailed error handling ──
    // This catches schema issues (wrong column types) early with clear messages
    const firstPerm = PERMISSION_DEFINITIONS[0];
    try {
        await table.insertRow({
            permission_id: baseTs + 1,
            permission_key: firstPerm.key,
            resource: firstPerm.resource,
            action: firstPerm.action,
            description: firstPerm.desc,
        });
    } catch (err) {
        const errMsg = (err.message || '').toLowerCase();

        // Detect the specific "bigint value expected" error — column type mismatch
        if (errMsg.includes('bigint value expected') || errMsg.includes('invalid input value')) {
            const { AppError } = require('../core/errors');

            // Figure out which column is wrong
            let wrongColumn = 'unknown';
            const originalMsg = err.message || '';
            for (const col of ['permission_key', 'resource', 'action', 'description']) {
                if (originalMsg.toLowerCase().includes(col)) {
                    wrongColumn = col;
                    break;
                }
            }

            throw new AppError(
                `SCHEMA ERROR in "Permissions" table: Column "${wrongColumn}" is configured as BIGINT but must be VARCHAR.\n\n` +
                `The column stores text values (e.g., "${firstPerm.key}"), not numbers.\n\n` +
                `TO FIX (in Catalyst Console → Data Store → "Permissions" table → Schema View):\n` +
                `  1. DELETE the "${wrongColumn}" column (click column → delete icon)\n` +
                `  2. Click "+ New Column" → Name: "${wrongColumn}" → Type: "varchar" → Max Length: 100\n` +
                `  3. Repeat for any other wrongly-typed columns.\n\n` +
                `CORRECT column types for the Permissions table:\n` +
                `  ┌───────────────────┬──────────────┐\n` +
                `  │ Column            │ Type         │\n` +
                `  ├───────────────────┼──────────────┤\n` +
                `  │ permission_id     │ bigint       │\n` +
                `  │ permission_key    │ varchar(100) │\n` +
                `  │ resource          │ varchar(50)  │\n` +
                `  │ action            │ varchar(50)  │\n` +
                `  │ description       │ varchar(255) │\n` +
                `  └───────────────────┴──────────────┘\n\n` +
                `Original error: ${err.message}`,
                422,
                'SCHEMA_TYPE_MISMATCH'
            );
        }

        // Unknown error — re-throw
        throw err;
    }

    // First one succeeded — insert the rest
    let successCount = 1;
    const failures = [];

    for (let i = 1; i < PERMISSION_DEFINITIONS.length; i++) {
        const p = PERMISSION_DEFINITIONS[i];
        try {
            await table.insertRow({
                permission_id: baseTs + i + 1,
                permission_key: p.key,
                resource: p.resource,
                action: p.action,
                description: p.desc,
            });
            successCount++;
        } catch (err) {
            console.error(`Failed to insert permission "${p.key}":`, err.message);
            failures.push({ key: p.key, error: err.message });
        }
    }

    if (failures.length > 0) {
        console.warn(`Seeded ${successCount}/${PERMISSION_DEFINITIONS.length} permissions. ${failures.length} failed.`);
    } else {
        console.log(`Seeded all ${PERMISSION_DEFINITIONS.length} permissions successfully.`);
    }
};

module.exports = { seedPermissions, PERMISSION_DEFINITIONS };
