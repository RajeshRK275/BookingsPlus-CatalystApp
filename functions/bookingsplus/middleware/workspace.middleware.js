/**
 * Workspace Middleware — Resolves the active workspace for the request.
 * 
 * Reads X-Workspace-Id from request headers (set by frontend axios interceptor).
 * Validates the user has an active membership in UserWorkspaces for that workspace.
 * Super admins bypass the membership check.
 * Attaches req.workspaceId and req.userRole to the request.
 * 
 * KNOWN DATA ISSUE: During initial onboarding, the setup code stored sequential
 * Date.now()+N values. UserWorkspaces may have:
 *   - workspace_id that is ±1-5 off from the actual Workspaces.ROWID
 *   - user_id that is ±1-5 off from the actual Users.ROWID
 *   - role_id that is a custom timestamp, not a Roles.ROWID
 * We handle all these cases with multi-strategy + fuzzy matching.
 */
const { executeZCQL } = require('../utils/datastore');

const workspaceMiddleware = async (req, res, next) => {
    try {
        const workspaceId = req.headers['x-workspace-id'];

        if (!workspaceId) {
            return res.status(400).json({
                success: false,
                message: 'Missing X-Workspace-Id header. Select a workspace.'
            });
        }

        // Validate workspace exists and is active
        const wsResult = await executeZCQL(req,
            `SELECT * FROM Workspaces WHERE ROWID = '${workspaceId}'`
        );

        if (wsResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Workspace not found.'
            });
        }

        const workspace = wsResult[0].Workspaces;

        if (workspace.status === 'suspended' || workspace.status === 'archived') {
            return res.status(403).json({
                success: false,
                message: `Workspace "${workspace.workspace_name}" is ${workspace.status}.`
            });
        }

        // Super admins bypass membership check
        if (req.user.is_super_admin) {
            req.workspaceId = workspaceId;
            req.workspace = workspace;
            req.userRole = { role_name: 'Super Admin', role_level: 100, role_id: null };
            return next();
        }

        // ── Validate user's membership ──
        const userId = req.user.user_id || req.user.ROWID;
        const userROWID = req.user.ROWID;

        // Collect all possible user IDs to check
        const userIdsToTry = new Set();
        userIdsToTry.add(String(userId));
        if (userROWID) userIdsToTry.add(String(userROWID));

        // Also look up ROWID from custom user_id
        try {
            const userLookup = await executeZCQL(req,
                `SELECT ROWID FROM Users WHERE user_id = '${userId}'`
            );
            if (userLookup.length > 0) {
                userIdsToTry.add(String(userLookup[0].Users.ROWID));
            }
        } catch (e) { /* ignore */ }

        // Collect all possible workspace IDs to check
        const wsIdsToTry = new Set();
        wsIdsToTry.add(String(workspaceId));
        if (workspace.workspace_id && String(workspace.workspace_id) !== String(workspaceId)) {
            wsIdsToTry.add(String(workspace.workspace_id));
        }

        // Try exact matches: user_id × workspace_id combinations
        let membershipResult = [];
        for (const uid of userIdsToTry) {
            if (membershipResult.length > 0) break;
            for (const wsId of wsIdsToTry) {
                if (membershipResult.length > 0) break;
                try {
                    membershipResult = await executeZCQL(req,
                        `SELECT * FROM UserWorkspaces WHERE user_id = '${uid}' AND workspace_id = '${wsId}'`
                    );
                } catch (e) { /* ignore */ }
            }
        }

        // Fuzzy fallback: fetch all active UserWorkspaces and match by proximity
        // This handles the onboarding bug where IDs are off by 1-5
        if (membershipResult.length === 0) {
            console.log('[WorkspaceMiddleware] Exact match failed, trying fuzzy match...');
            try {
                const allUw = await executeZCQL(req, `SELECT * FROM UserWorkspaces WHERE status = 'active'`);
                const targetWsId = parseInt(String(workspaceId), 10);
                const targetUserIds = [...userIdsToTry].map(id => parseInt(id, 10)).filter(n => !isNaN(n));

                for (const row of allUw) {
                    const uw = row.UserWorkspaces || row;
                    const uwWsId = parseInt(String(uw.workspace_id), 10);
                    const uwUserId = parseInt(String(uw.user_id), 10);

                    if (isNaN(uwWsId) || isNaN(uwUserId)) continue;

                    // workspace_id within ±10
                    const wsMatch = !isNaN(targetWsId) && Math.abs(uwWsId - targetWsId) <= 10;
                    // user_id within ±10 of any candidate user IDs
                    const userMatch = targetUserIds.some(tid => Math.abs(uwUserId - tid) <= 10);

                    if (wsMatch && userMatch) {
                        membershipResult = [row];
                        console.log(`[WorkspaceMiddleware] Fuzzy matched: UW.user_id=${uw.user_id} (target: ${targetUserIds}), UW.workspace_id=${uw.workspace_id} (target: ${targetWsId})`);
                        break;
                    }
                }
            } catch (e) {
                console.warn('[WorkspaceMiddleware] Fuzzy fallback failed:', e.message);
            }
        }

        if (membershipResult.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'You do not have access to this workspace.'
            });
        }

        const uwData = membershipResult[0].UserWorkspaces || membershipResult[0];

        if (uwData.status === 'suspended') {
            return res.status(403).json({
                success: false,
                message: 'Your access to this workspace has been suspended.'
            });
        }

        // Resolve role — role_id might be ROWID or custom role_id (timestamp)
        let roleName = 'Staff';
        let roleLevel = 0;
        if (uwData.role_id) {
            try {
                // Try direct ROWID match
                let roleResult = await executeZCQL(req,
                    `SELECT role_name, role_level FROM Roles WHERE ROWID = '${uwData.role_id}'`
                );

                // Fallback: try custom role_id field match
                if (roleResult.length === 0) {
                    roleResult = await executeZCQL(req,
                        `SELECT role_name, role_level FROM Roles WHERE role_id = '${uwData.role_id}'`
                    );
                }

                // Fuzzy fallback: find role with closest ROWID or custom role_id
                if (roleResult.length === 0) {
                    const allRoles = await executeZCQL(req, `SELECT * FROM Roles`);
                    const targetRoleId = parseInt(String(uwData.role_id), 10);
                    if (!isNaN(targetRoleId)) {
                        let bestDist = Infinity;
                        for (const r of allRoles) {
                            const role = r.Roles || r;
                            const rRowId = parseInt(String(role.ROWID), 10);
                            const rCustomId = parseInt(String(role.role_id), 10);
                            const distRow = !isNaN(rRowId) ? Math.abs(rRowId - targetRoleId) : Infinity;
                            const distCustom = !isNaN(rCustomId) ? Math.abs(rCustomId - targetRoleId) : Infinity;
                            const dist = Math.min(distRow, distCustom);
                            if (dist <= 10 && dist < bestDist) {
                                bestDist = dist;
                                roleResult = [r];
                            }
                        }
                    }
                }

                if (roleResult.length > 0) {
                    const role = roleResult[0].Roles || roleResult[0];
                    roleName = role.role_name || 'Staff';
                    roleLevel = parseInt(role.role_level) || 0;
                }
            } catch (roleErr) {
                console.warn('[WorkspaceMiddleware] Role lookup failed (using defaults):', roleErr.message);
            }
        }

        req.workspaceId = workspaceId;
        req.workspace = workspace;
        req.userRole = {
            role_id: uwData.role_id,
            role_name: roleName,
            role_level: roleLevel,
        };

        next();
    } catch (err) {
        console.error('Workspace middleware error:', err);
        return res.status(500).json({
            success: false,
            message: 'Workspace resolution error: ' + err.message
        });
    }
};

module.exports = workspaceMiddleware;
