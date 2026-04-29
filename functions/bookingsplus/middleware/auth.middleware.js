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

        // ── PARALLEL: Check org + user at the same time to save latency ──
        const [organizationId, userRows] = await Promise.all([
            getOrganizationId(req),
            executeZCQL(req, `SELECT * FROM Users WHERE catalyst_user_id = '${catalystUserId}'`).catch(() => []),
        ]);

        // ══════════════════════════════════════════════════════════════
        // FIRST-TIME SETUP: No Organization exists yet.
        // ══════════════════════════════════════════════════════════════
        if (!organizationId) {
            console.log('No organization found — first-time setup mode for:', catalystEmail);

            const existingUser = userRows.length > 0 ? userRows[0].Users : null;

            req.user = {
                user_id: existingUser ? (existingUser.user_id || existingUser.ROWID) : `temp-${catalystUserId}`,
                catalyst_user_id: catalystUserId,
                catalyst_role_id: catalystUser.role_id ? String(catalystUser.role_id) : '',
                email: existingUser ? existingUser.email : catalystEmail,
                display_name: existingUser ? existingUser.display_name : catalystName,
                is_super_admin: true,
                role_version: 0,
                status: 'active',
                ROWID: existingUser ? existingUser.ROWID : null,
                _isTemporary: true,
                _needsDbInsert: !existingUser,
            };

            return next();
        }

        // ══════════════════════════════════════════════════════════════
        // NORMAL FLOW: Organization exists — proceed with DB lookup/insert
        // ══════════════════════════════════════════════════════════════
        let localUser;

        if (userRows.length > 0) {
            localUser = userRows[0].Users;
        } else {
            // User not found by catalyst_user_id — check by email
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
                // Auto-provision new user
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
                    organization_id: toBigInt(organizationId),
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

        // ══════════════════════════════════════════════════════════════
        // SUPER ADMIN AUTO-FIX (only for the first/only user in the system)
        // This is a blocking check because req.user.is_super_admin is set
        // based on localUser.is_super_admin right after this block.
        // The DB update is fire-and-forget to save latency.
        // ══════════════════════════════════════════════════════════════
        if (localUser.is_super_admin !== 'true') {
            try {
                const allUsersCount = await executeZCQL(req, `SELECT COUNT(ROWID) FROM Users`);
                const totalUsers = parseInt(
                    (allUsersCount[0]?.Users?.ROWID || allUsersCount[0]?.Users?.['ROWID.count'] || '0'), 10
                );
                if (totalUsers <= 1) {
                    console.log(`[Auth] Auto-promoting ${catalystEmail} to super_admin (only user in system)`);
                    localUser.is_super_admin = 'true';
                    // Fire-and-forget: persist in background, don't block the request
                    getDatastore(req).table('Users').updateRow({
                        ROWID: localUser.ROWID,
                        is_super_admin: 'true',
                    }).catch(e => console.error('[Auth] Failed to persist super admin flag:', e.message));
                }
            } catch (countErr) {
                console.warn('[Auth] Could not count users for super admin check:', countErr.message);
            }
        }

        // ── Attach authenticated user + organizationId to request ──
        // NOTE: Removed the UserRoleMapping query — that table doesn't exist
        // and was causing an unnecessary DB call on every request.
        req.organizationId = organizationId;
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
