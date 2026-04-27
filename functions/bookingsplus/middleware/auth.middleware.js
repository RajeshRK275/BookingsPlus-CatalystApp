/**
 * Auth Middleware — Catalyst Embedded Authentication.
 * 
 * PRODUCTION: Uses Catalyst User Management to get authenticated user.
 * DEV_MODE: Falls back to mock dev user for local testing.
 * 
 * FIRST-TIME SETUP FLOW:
 * When a brand-new user visits the app for the first time, there is NO Organization
 * row yet (they haven't completed setup). The Users table has a mandatory
 * organization_id column (BIGINT), so we CANNOT insert a user row without a valid
 * numeric org ROWID.
 * 
 * Solution: If no Organization exists yet, we pass the authenticated Catalyst user
 * through WITHOUT creating a local Users row. The user gets a temporary in-memory
 * user object with is_super_admin=true so they can access the /organizations/setup
 * endpoint. Once setup completes and the Organization is created, the user row is
 * created with the real organization_id by the setup service.
 * 
 * IMPORTANT: All _id columns in Catalyst Data Store are typed as BIGINT.
 * We must NEVER pass strings like 'pending', 'temp-xxx', or non-numeric values
 * to BIGINT columns. Use toBigInt() to coerce all ID values before insert.
 */
const config = require('../utils/config');
const { executeZCQL, getDatastore, catalystDateTime } = require('../utils/datastore');

/** Coerce any value to a safe BIGINT-compatible number */
const toBigInt = (value) => {
    if (value === null || value === undefined) return Date.now();
    if (typeof value === 'number' && !isNaN(value)) return value;
    const parsed = parseInt(String(value), 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
    return Date.now();
};

/**
 * Fetches the Organization ROWID from the datastore.
 * Returns null if no Organization exists yet (first-time setup scenario).
 */
const getOrganizationId = async (req) => {
    try {
        const zcql = req.catalystApp.zcql();
        const result = await zcql.executeZCQLQuery('SELECT ROWID FROM Organization LIMIT 1');
        if (result && result.length > 0) {
            const rowId = result[0].Organization.ROWID;
            if (rowId) return String(rowId);
        }
    } catch (e) {
        console.warn('getOrganizationId: No organization found (expected during first setup):', e.message);
    }
    return null;
};

/**
 * Safe row insert helper — attempts insert and if it fails due to column mismatch,
 * retries with progressively fewer optional columns.
 */
const safeInsertUser = async (datastore, userData) => {
    try {
        return await datastore.table('Users').insertRow(userData);
    } catch (err) {
        const errMsg = (err.message || '').toLowerCase();
        if (errMsg.includes('invalid input value') || errMsg.includes('invalid column') || errMsg.includes('mandatory') || errMsg.includes('does not exist')) {
            console.warn('User insert failed with all columns, retrying with core columns only:', err.message);
            // Core columns that must exist in every Data Store setup
            const coreData = {
                user_id: userData.user_id,
                catalyst_user_id: userData.catalyst_user_id,
                organization_id: userData.organization_id,
                display_name: userData.display_name,
                email: userData.email,
                is_super_admin: userData.is_super_admin,
                status: userData.status,
                created_at: userData.created_at,
            };
            // Try adding back optional fields one at a time
            const optionalFields = ['catalyst_role_id', 'phone', 'role_version', 'color', 'initials', 'avatar_url', 'designation', 'gender', 'dob'];
            for (const field of optionalFields) {
                if (userData[field] !== undefined) {
                    coreData[field] = userData[field];
                }
            }
            try {
                return await datastore.table('Users').insertRow(coreData);
            } catch (retryErr) {
                console.warn('Retry with optional fields also failed, using minimum columns:', retryErr.message);
                const minData = {
                    user_id: userData.user_id,
                    catalyst_user_id: userData.catalyst_user_id,
                    organization_id: userData.organization_id,
                    display_name: userData.display_name,
                    email: userData.email,
                    is_super_admin: userData.is_super_admin,
                    status: userData.status,
                    created_at: userData.created_at,
                };
                return await datastore.table('Users').insertRow(minData);
            }
        }
        throw err;
    }
};

const authMiddleware = async (req, res, next) => {
    try {
        // ── DEV MODE: Mock user for local development ──
        if (config.devMode) {
            req.user = {
                user_id: 'dev-user-1',
                catalyst_user_id: 'dev-user-1',
                email: 'admin@bookingsplus.dev',
                display_name: 'Admin User',
                is_super_admin: true,
                role_version: 0,
            };
            return next();
        }

        // ── PRODUCTION: Catalyst Embedded Auth ──
        let catalystUser;
        try {
            catalystUser = await req.catalystApp.userManagement().getCurrentUser();
        } catch (authErr) {
            console.error('Catalyst auth failed:', authErr.message);
            return res.status(401).json({
                success: false,
                message: 'Authentication required. Please log in.'
            });
        }

        if (!catalystUser || !catalystUser.user_id) {
            return res.status(401).json({
                success: false,
                message: 'Invalid session. Please log in again.'
            });
        }

        const catalystUserId = String(catalystUser.user_id);
        const catalystEmail = catalystUser.email_id;
        const catalystName = `${catalystUser.first_name || ''} ${catalystUser.last_name || ''}`.trim() || catalystEmail.split('@')[0];

        // ── Check if Organization exists ──
        const organizationId = await getOrganizationId(req);

        // ══════════════════════════════════════════════════════════════
        // FIRST-TIME SETUP: No Organization exists yet.
        // The user is authenticated via Catalyst but we CANNOT create
        // a Users row because organization_id is mandatory.
        // Pass them through with a temporary in-memory user object
        // so they can complete the /organizations/setup flow.
        // ══════════════════════════════════════════════════════════════
        if (!organizationId) {
            console.log('No organization found — first-time setup mode for:', catalystEmail);

            // Check if user already exists in DB (edge case: org was deleted but users remain)
            let existingUser = null;
            try {
                const rows = await executeZCQL(req,
                    `SELECT * FROM Users WHERE catalyst_user_id = '${catalystUserId}'`
                );
                if (rows.length > 0) existingUser = rows[0].Users;
            } catch (e) { /* Users table might not have data yet */ }

            if (!existingUser) {
                try {
                    const rows = await executeZCQL(req,
                        `SELECT * FROM Users WHERE email = '${catalystEmail}'`
                    );
                    if (rows.length > 0) existingUser = rows[0].Users;
                } catch (e) { /* ignore */ }
            }

            // Provide a temporary in-memory user — NOT persisted to DB yet
            req.user = {
                user_id: existingUser ? (existingUser.user_id || existingUser.ROWID) : `temp-${catalystUserId}`,
                catalyst_user_id: catalystUserId,
                catalyst_role_id: catalystUser.role_id ? String(catalystUser.role_id) : '',
                email: existingUser ? existingUser.email : catalystEmail,
                display_name: existingUser ? existingUser.display_name : catalystName,
                is_super_admin: true,  // First user is always super admin during setup
                role_version: 0,
                status: 'active',
                ROWID: existingUser ? existingUser.ROWID : null,
                _isTemporary: true,    // Flag: user row not yet persisted
                _needsDbInsert: !existingUser, // Flag: needs to be inserted after org setup
            };

            return next();
        }

        // ══════════════════════════════════════════════════════════════
        // NORMAL FLOW: Organization exists — proceed with DB lookup/insert
        // ══════════════════════════════════════════════════════════════

        // ── Lookup user in our Users table ──
        let userRows;
        try {
            userRows = await executeZCQL(req,
                `SELECT * FROM Users WHERE catalyst_user_id = '${catalystUserId}'`
            );
        } catch (e) {
            userRows = [];
        }

        let localUser;

        if (userRows.length > 0) {
            localUser = userRows[0].Users;
        } else {
            // ── Auto-provision: First time this Catalyst user logs in ──
            let preExisting = [];
            try {
                preExisting = await executeZCQL(req,
                    `SELECT * FROM Users WHERE email = '${catalystEmail}'`
                );
            } catch (e) { /* ignore */ }

            if (preExisting.length > 0) {
                localUser = preExisting[0].Users;
                try {
                    const datastore = getDatastore(req);
                    await datastore.table('Users').updateRow({
                        ROWID: localUser.ROWID,
                        catalyst_user_id: catalystUserId,
                    });
                    localUser.catalyst_user_id = catalystUserId;
                } catch (updateErr) {
                    console.error('Failed to link catalyst_user_id to existing user:', updateErr.message);
                }
            } else {
                // Organization exists — safe to insert with valid organization_id
                const datastore = getDatastore(req);
                const isSuperAdmin = config.initialSuperAdminEmail &&
                    catalystEmail.toLowerCase() === config.initialSuperAdminEmail.toLowerCase();

                const newUserRow = await safeInsertUser(datastore, {
                    user_id: Date.now(),
                    catalyst_user_id: catalystUserId,
                    catalyst_role_id: catalystUser.role_id ? String(catalystUser.role_id) : '',
                    display_name: catalystName,
                    email: catalystEmail,
                    phone: '',
                    organization_id: toBigInt(organizationId), // BIGINT — must be numeric
                    is_super_admin: isSuperAdmin ? 'true' : 'false',
                    role_version: 0,
                    status: 'active',
                    color: '#E0E7FF',
                    initials: catalystName.substring(0, 2).toUpperCase(),
                    created_at: catalystDateTime(),
                });
                localUser = newUserRow;
            }
        }

        // ── Check role_version staleness (admin-driven session invalidation) ──
        try {
            const mappingResult = await executeZCQL(req,
                `SELECT * FROM UserRoleMapping WHERE catalyst_user_id = '${catalystUserId}'`
            );
            if (mappingResult.length > 0) {
                const mapping = mappingResult[0].UserRoleMapping;
                const mappingVersion = parseInt(mapping.role_version) || 0;
                const userVersion = parseInt(localUser.role_version) || 0;

                if (mappingVersion > userVersion) {
                    try {
                        const datastore = getDatastore(req);
                        await datastore.table('Users').updateRow({
                            ROWID: localUser.ROWID,
                            catalyst_role_id: mapping.catalyst_role_id || '',
                            role_version: mappingVersion,
                        });
                        localUser.catalyst_role_id = mapping.catalyst_role_id;
                        localUser.role_version = mappingVersion;
                    } catch (syncErr) {
                        console.error('Role version sync failed:', syncErr.message);
                    }
                }
            }
        } catch (e) {
            // UserRoleMapping table might not exist yet — ignore
        }

        // ── Attach authenticated user to request ──
        req.user = {
            user_id: localUser.user_id || localUser.ROWID,
            catalyst_user_id: catalystUserId,
            catalyst_role_id: localUser.catalyst_role_id || '',
            email: localUser.email || catalystEmail,
            display_name: localUser.display_name || catalystName,
            is_super_admin: localUser.is_super_admin === 'true',
            role_version: parseInt(localUser.role_version) || 0,
            status: localUser.status || 'active',
            ROWID: localUser.ROWID,
        };

        if (req.user.status === 'suspended' || req.user.status === 'deactivated') {
            return res.status(403).json({
                success: false,
                message: 'Your account has been suspended. Contact your administrator.'
            });
        }

        next();
    } catch (err) {
        console.error('Auth middleware error:', err);
        return res.status(500).json({
            success: false,
            message: 'Authentication error: ' + err.message
        });
    }
};

module.exports = authMiddleware;
