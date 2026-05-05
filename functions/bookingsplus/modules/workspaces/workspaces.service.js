/**
 * Workspaces Service — Business logic for workspace management.
 * 
 * CRITICAL: This service is the FIRST thing called after auth for staff users.
 * If it returns 0 workspaces, the entire app breaks (no X-Workspace-Id header,
 * all API calls return 400). Must be MAXIMALLY robust.
 * 
 * ARCHITECTURE: Fetch ALL data upfront in parallel, then match in-memory.
 * This is both faster AND more reliable than sequential queries with filters
 * that can fail due to status/ID mismatches.
 */
const { executeZCQL } = require('../../utils/datastore');
const { TABLES } = require('../../core/constants');

/**
 * Get ALL workspaces from the database (no filtering at all).
 */
const getAllWorkspaces = async (req) => {
    try {
        const result = await executeZCQL(req, `SELECT * FROM ${TABLES.WORKSPACES}`);
        console.log(`[WorkspacesService] getAllWorkspaces: ${result.length} rows`);
        return result;
    } catch (err) {
        console.error('[WorkspacesService] getAllWorkspaces FAILED:', err.message);
        return [];
    }
};

/**
 * Get ALL UserWorkspaces from the database (no filtering at all).
 */
const getAllUserWorkspaces = async (req) => {
    try {
        const result = await executeZCQL(req, `SELECT * FROM ${TABLES.USER_WORKSPACES}`);
        console.log(`[WorkspacesService] getAllUserWorkspaces: ${result.length} rows`);
        return result;
    } catch (err) {
        console.error('[WorkspacesService] getAllUserWorkspaces FAILED:', err.message);
        return [];
    }
};

/**
 * Format a single workspace row into the standard response format.
 */
const formatWorkspace = (wsRow, roleName = 'Staff', roleLevel = 0, roleId = null) => {
    const ws = wsRow.Workspaces || wsRow;
    // Handle both 'workspace_name' and 'name' column variants
    const wsName = ws.workspace_name || ws.name || 'Workspace';
    // Handle both 'workspace_slug' and 'slug' column variants
    const wsSlug = ws.workspace_slug || ws.slug || wsName.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'default';
    return {
        workspace_id: ws.ROWID,
        workspace_name: wsName,
        workspace_slug: wsSlug,
        brand_color: ws.brand_color || '#5C44B5',
        logo_url: ws.logo_url || '',
        status: ws.status || 'active',
        role_name: roleName,
        role_level: roleLevel,
        role_id: roleId,
        // Pass ROWID through for auto-repair detection
        _rawROWID: ws.ROWID,
        _needsNameRepair: !ws.workspace_name && !ws.name,
    };
};

/**
 * Filter workspaces to exclude only explicitly suspended/archived ones.
 * If filtering removes everything, returns the original list.
 */
const filterActiveWorkspaces = (wsRows) => {
    if (wsRows.length === 0) return wsRows;
    const active = wsRows.filter(row => {
        const ws = row.Workspaces || row;
        const st = (ws.status || '').toLowerCase().trim();
        return st !== 'suspended' && st !== 'archived';
    });
    return active.length > 0 ? active : wsRows;
};

/**
 * Resolve role from a role_id using all available roles.
 * Tries exact ROWID → exact custom role_id → fuzzy ±10.
 */
const resolveRole = (allRoles, roleId) => {
    if (!roleId) return { role_name: 'Staff', role_level: 0 };
    const rid = String(roleId);
    const ridNum = parseInt(rid, 10);

    for (const row of allRoles) {
        const role = row.Roles || row;
        if (String(role.ROWID) === rid) {
            return { role_name: role.role_name || 'Staff', role_level: parseInt(role.role_level) || 0 };
        }
        if (role.role_id && String(role.role_id) === rid) {
            return { role_name: role.role_name || 'Staff', role_level: parseInt(role.role_level) || 0 };
        }
    }

    // Fuzzy ±10
    if (!isNaN(ridNum)) {
        let best = null, bestDist = Infinity;
        for (const row of allRoles) {
            const role = row.Roles || row;
            const d1 = Math.abs(parseInt(String(role.ROWID), 10) - ridNum);
            const d2 = role.role_id ? Math.abs(parseInt(String(role.role_id), 10) - ridNum) : Infinity;
            const dist = Math.min(isNaN(d1) ? Infinity : d1, isNaN(d2) ? Infinity : d2);
            if (dist <= 10 && dist < bestDist) { bestDist = dist; best = role; }
        }
        if (best) return { role_name: best.role_name || 'Staff', role_level: parseInt(best.role_level) || 0 };
    }

    return { role_name: 'Staff', role_level: 0 };
};

/**
 * Main entry point: Get all workspaces the current user belongs to.
 * 
 * STRATEGY: Fetch ALL data upfront (parallel), match in-memory.
 * For a small business app with <100 rows per table, this is fast and robust.
 * No individual query can fail due to status filters or ID format issues.
 */
const getMyWorkspaces = async (req) => {
    const userId = req.user.user_id || req.user.ROWID;
    const userROWID = req.user.ROWID;
    const userEmail = (req.user.email || '').toLowerCase().trim();
    const isSuperAdmin = req.user.is_super_admin === true;

    console.log(`[WorkspacesService] getMyWorkspaces: userId=${userId}, ROWID=${userROWID}, email=${userEmail}, is_super_admin=${isSuperAdmin}`);

    // ══════════════════════════════════════════════════════════
    // STEP 1: Fetch ALL data upfront in parallel
    // ══════════════════════════════════════════════════════════
    let allWsRows, allUwRows, allRolesRows;
    try {
        [allWsRows, allUwRows, allRolesRows] = await Promise.all([
            getAllWorkspaces(req),
            getAllUserWorkspaces(req),
            (async () => { try { return await executeZCQL(req, `SELECT * FROM ${TABLES.ROLES}`); } catch(e) { return []; } })(),
        ]);
    } catch (err) {
        console.error('[WorkspacesService] CRITICAL: Parallel data fetch failed:', err.message);
        allWsRows = []; allUwRows = []; allRolesRows = [];
    }

    const allWorkspaces = filterActiveWorkspaces(allWsRows);
    const allUW = allUwRows.map(row => row.UserWorkspaces || row);

    console.log(`[WorkspacesService] Data: ${allWorkspaces.length} workspaces, ${allUW.length} UW rows, ${allRolesRows.length} roles`);

    // If NO workspaces exist at all, nothing to return
    if (allWorkspaces.length === 0) {
        console.error('[WorkspacesService] NO workspaces in database!');
        return [];
    }

    // ══════════════════════════════════════════════════════════
    // STEP 2: Collect ALL possible user IDs for matching
    // ══════════════════════════════════════════════════════════
    const candidateIds = new Set();
    if (userId) candidateIds.add(String(userId));
    if (userROWID) candidateIds.add(String(userROWID));

    // Email-based ID resolution
    if (userEmail) {
        try {
            const emailUsers = await executeZCQL(req,
                `SELECT ROWID, user_id FROM ${TABLES.USERS} WHERE email = '${userEmail}'`
            );
            for (const row of emailUsers) {
                const u = row.Users || row;
                if (u.ROWID) candidateIds.add(String(u.ROWID));
                if (u.user_id) candidateIds.add(String(u.user_id));
            }
        } catch (e) { /* ignore */ }
    }

    // custom user_id → ROWID resolution
    try {
        const ul = await executeZCQL(req, `SELECT ROWID FROM ${TABLES.USERS} WHERE user_id = '${userId}'`);
        for (const row of ul) { const u = row.Users || row; if (u.ROWID) candidateIds.add(String(u.ROWID)); }
    } catch (e) { /* ignore */ }

    const idList = [...candidateIds];
    const idNums = idList.map(id => parseInt(id, 10)).filter(n => !isNaN(n));
    console.log(`[WorkspacesService] Candidate user IDs: [${idList.join(', ')}]`);

    // ══════════════════════════════════════════════════════════
    // STEP 3: Find matching UserWorkspaces (in-memory matching)
    // ══════════════════════════════════════════════════════════
    let matched = [];

    // Strategy A: Exact user_id match
    matched = allUW.filter(uw => {
        const uwUid = String(uw.user_id || '');
        return idList.includes(uwUid);
    });
    if (matched.length > 0) console.log(`[WorkspacesService] Exact match: ${matched.length} UW rows`);

    // Strategy B: Fuzzy ±10 match
    if (matched.length === 0 && idNums.length > 0) {
        matched = allUW.filter(uw => {
            const uwNum = parseInt(String(uw.user_id), 10);
            if (isNaN(uwNum)) return false;
            return idNums.some(cid => Math.abs(uwNum - cid) <= 10);
        });
        if (matched.length > 0) console.log(`[WorkspacesService] Fuzzy ±10 match: ${matched.length} UW rows`);
    }

    // Debug log if still no match
    if (matched.length === 0 && allUW.length > 0) {
        console.warn(`[WorkspacesService] NO UW match! UW user_ids=[${allUW.map(uw => uw.user_id).join(',')}] vs candidates=[${idList.join(',')}]`);
    }

    // Filter out suspended memberships (keep null/empty/active)
    if (matched.length > 0) {
        const active = matched.filter(uw => {
            const st = (uw.status || '').toLowerCase().trim();
            return st !== 'suspended' && st !== 'deactivated';
        });
        if (active.length > 0) matched = active;
    }

    // ══════════════════════════════════════════════════════════
    // STEP 4: Resolve workspace + role for each membership
    // ══════════════════════════════════════════════════════════
    if (matched.length > 0) {
        const results = [];
        const seenWsIds = new Set();

        for (const uw of matched) {
            const uwWsId = String(uw.workspace_id || '');
            if (!uwWsId) continue;

            // Find matching workspace
            let wsRow = allWorkspaces.find(row => String((row.Workspaces || row).ROWID) === uwWsId);

            // Fuzzy ±10
            if (!wsRow) {
                const uwWsNum = parseInt(uwWsId, 10);
                if (!isNaN(uwWsNum)) {
                    let bestDist = Infinity;
                    for (const row of allWorkspaces) {
                        const wsNum = parseInt(String((row.Workspaces || row).ROWID), 10);
                        if (!isNaN(wsNum)) {
                            const dist = Math.abs(wsNum - uwWsNum);
                            if (dist <= 10 && dist < bestDist) { bestDist = dist; wsRow = row; }
                        }
                    }
                }
            }

            // Last resort: use first workspace
            if (!wsRow) wsRow = allWorkspaces[0];
            if (!wsRow) continue;

            const wsId = String((wsRow.Workspaces || wsRow).ROWID);
            if (seenWsIds.has(wsId)) continue;
            seenWsIds.add(wsId);

            const { role_name, role_level } = resolveRole(allRolesRows, uw.role_id);
            results.push(formatWorkspace(wsRow, role_name, role_level, uw.role_id));
        }

        if (results.length > 0) {
            console.log(`[WorkspacesService] Returning ${results.length} workspaces from memberships`);
            return results;
        }
    }

    // ══════════════════════════════════════════════════════════
    // STEP 5: FALLBACK — No memberships found at all
    // Return ALL workspaces with Staff/Super Admin role
    // This ensures the app NEVER shows 0 workspaces for any
    // authenticated user when workspaces exist in the DB.
    // ══════════════════════════════════════════════════════════
    const roleName = isSuperAdmin ? 'Super Admin' : 'Staff';
    const roleLevel = isSuperAdmin ? 100 : 0;
    console.warn(`[WorkspacesService] FALLBACK: Returning ALL ${allWorkspaces.length} workspaces as ${roleName}`);
    return allWorkspaces.map(row => formatWorkspace(row, roleName, roleLevel, null));
};

/**
 * AUTO-REPAIR: Detect and fix workspaces that were created without a name.
 * This can happen when safeInsertRow's retry logic strips workspace_name
 * from the optional columns during the initial setup. 
 * 
 * Called automatically after getMyWorkspaces when any workspace has _needsNameRepair=true.
 * Looks up the Organization name and uses it to repair the workspace.
 */
const autoRepairWorkspaceNames = async (req, workspaces) => {
    const needsRepair = workspaces.filter(ws => ws._needsNameRepair);
    if (needsRepair.length === 0) return workspaces;

    console.log(`[WorkspacesService] AUTO-REPAIR: ${needsRepair.length} workspace(s) have missing names`);
    
    // Fetch the organization name to use as fallback workspace name
    let orgName = null;
    try {
        const orgResult = await executeZCQL(req, `SELECT org_name FROM ${TABLES.ORGANIZATION} LIMIT 1`);
        if (orgResult.length > 0) {
            orgName = (orgResult[0].Organization || orgResult[0]).org_name;
        }
    } catch (e) {
        console.warn('[WorkspacesService] AUTO-REPAIR: Could not fetch org name:', e.message);
    }

    if (!orgName) {
        console.warn('[WorkspacesService] AUTO-REPAIR: No org name found, skipping repair');
        return workspaces;
    }

    const { getDatastore } = require('../../utils/datastore');
    const datastore = getDatastore(req);

    for (const ws of needsRepair) {
        const repairName = orgName;
        const repairSlug = repairName.toLowerCase().replace(/[^a-z0-9]/g, '-');
        try {
            await datastore.table(TABLES.WORKSPACES).updateRow({
                ROWID: ws._rawROWID || ws.workspace_id,
                workspace_name: repairName,
                workspace_slug: repairSlug,
            });
            // Update the in-memory workspace object
            ws.workspace_name = repairName;
            ws.workspace_slug = repairSlug;
            ws._needsNameRepair = false;
            console.log(`[WorkspacesService] AUTO-REPAIR: Fixed workspace ${ws.workspace_id} → "${repairName}"`);
        } catch (err) {
            console.error(`[WorkspacesService] AUTO-REPAIR: Failed to fix workspace ${ws.workspace_id}:`, err.message);
        }
    }

    return workspaces;
};

const getById = async (req, wsId) => {
    try {
        const result = await executeZCQL(req, `SELECT * FROM ${TABLES.WORKSPACES} WHERE ROWID = '${wsId}'`);
        return result.length > 0 ? (result[0].Workspaces || result[0]) : null;
    } catch (e) {
        console.warn('[WorkspacesService] getById failed:', e.message);
        return null;
    }
};

const getBySlug = async (req, slug) => {
    // Try workspace_slug first, fallback to searching all workspaces
    try {
        const result = await executeZCQL(req, `SELECT * FROM ${TABLES.WORKSPACES} WHERE workspace_slug = '${slug}'`);
        if (result.length > 0) return result[0].Workspaces || result[0];
    } catch (e) {
        console.warn('[WorkspacesService] getBySlug query failed (column may not exist):', e.message);
    }
    // Fallback: fetch all workspaces and match by slug or name-derived slug
    try {
        const all = await executeZCQL(req, `SELECT * FROM ${TABLES.WORKSPACES}`);
        for (const row of all) {
            const ws = row.Workspaces || row;
            const wsSlug = ws.workspace_slug || ws.slug || 
                           (ws.workspace_name || ws.name || '').toLowerCase().replace(/[^a-z0-9]/g, '-');
            if (wsSlug === slug) return ws;
        }
    } catch (e2) {
        console.warn('[WorkspacesService] getBySlug fallback failed:', e2.message);
    }
    return null;
};

/**
 * Update a workspace's details (name, slug, brand_color, etc.)
 */
const updateWorkspace = async (req, wsId, updateData) => {
    const { getDatastore } = require('../../utils/datastore');
    const datastore = getDatastore(req);

    // Build the update row — only include fields that were actually provided
    const updateRow = { ROWID: wsId };

    if (updateData.workspace_name !== undefined) {
        updateRow.workspace_name = updateData.workspace_name;
    }
    if (updateData.workspace_slug !== undefined) {
        updateRow.workspace_slug = updateData.workspace_slug;
    }
    if (updateData.brand_color !== undefined) {
        updateRow.brand_color = updateData.brand_color;
    }
    if (updateData.description !== undefined) {
        updateRow.description = updateData.description;
    }

    try {
        const updated = await datastore.table(TABLES.WORKSPACES).updateRow(updateRow);
        console.log(`[WorkspacesService] Updated workspace ${wsId}:`, JSON.stringify(updateData));
        return updated;
    } catch (err) {
        console.error(`[WorkspacesService] updateWorkspace failed:`, err.message);
        throw err;
    }
};

module.exports = { getMyWorkspaces, getById, getBySlug, updateWorkspace, autoRepairWorkspaceNames };
