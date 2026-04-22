/**
 * Auth Middleware — Catalyst Embedded Authentication.
 * 
 * PRODUCTION: Uses Catalyst User Management to get authenticated user.
 * DEV_MODE: Falls back to mock dev user for local testing.
 * 
 * Session invalidation: Checks role_version against UserRoleMapping.
 * If admin app has updated the mapping, user's local record is updated on-the-fly.
 */
const config = require('../utils/config');
const { executeZCQL, getDatastore } = require('../utils/datastore');

const authMiddleware = async (req, res, next) => {
    try {
        // ── DEV MODE: Mock user for local development ──
        if (config.devMode) {
            req.user = {
                user_id: 'dev-user-1',
                catalyst_user_id: 'dev-user-1',
                email: 'admin@bookingsplus.dev',
                name: 'Admin User',
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
                const datastore = getDatastore(req);
                await datastore.table('Users').updateRow({
                    ROWID: localUser.ROWID,
                    catalyst_user_id: catalystUserId,
                });
                localUser.catalyst_user_id = catalystUserId;
            } else {
                const datastore = getDatastore(req);
                const isSuperAdmin = config.initialSuperAdminEmail &&
                    catalystEmail.toLowerCase() === config.initialSuperAdminEmail.toLowerCase();

                const newUserRow = await datastore.table('Users').insertRow({
                    user_id: Date.now(),
                    catalyst_user_id: catalystUserId,
                    catalyst_role_id: catalystUser.role_id ? String(catalystUser.role_id) : '',
                    name: catalystName,
                    email: catalystEmail,
                    phone: '',
                    is_super_admin: isSuperAdmin ? 'true' : 'false',
                    role_version: 0,
                    status: 'active',
                    color: '#E0E7FF',
                    initials: catalystName.substring(0, 2).toUpperCase(),
                    created_at: new Date().toISOString(),
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
                    const datastore = getDatastore(req);
                    await datastore.table('Users').updateRow({
                        ROWID: localUser.ROWID,
                        catalyst_role_id: mapping.catalyst_role_id || '',
                        role_version: mappingVersion,
                    });
                    localUser.catalyst_role_id = mapping.catalyst_role_id;
                    localUser.role_version = mappingVersion;
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
            name: localUser.name || catalystName,
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
