/**
 * Notifications Routes — Serves real-time notifications from AuditLog table.
 * 
 * Notifications are derived from the AuditLog table, which already tracks
 * all system events (appointments created, services updated, customers added, etc.).
 * This module reads from AuditLog and transforms entries into user-friendly notifications.
 * 
 * It also supports marking notifications as read via a WorkspaceSettings key
 * that stores the timestamp of the last-read notification per user.
 */
const express = require('express');
const router = express.Router();
const asyncHandler = require('../../core/async-handler');
const response = require('../../core/response');
const { requirePermission } = require('../../middleware/permission.middleware');
const { executeZCQL, executeWorkspaceScopedZCQL, getDatastore, catalystDateTime } = require('../../utils/datastore');
const { TABLES } = require('../../core/constants');

/**
 * Transform an AuditLog entry into a user-friendly notification object.
 */
const transformAuditToNotification = (log) => {
    const action = log.action || '';
    const details = (() => {
        try { return JSON.parse(log.details_json || '{}'); } catch { return {}; }
    })();

    let message = '';
    let category = 'system';

    switch (action) {
        case 'appointment.created': {
            const customerName = details.customer_name || 'A customer';
            const staffName = details.resolved_staff || 'a staff member';
            const serviceName = details.service_name || 'a service';
            message = `${customerName} has scheduled an appointment with ${staffName} for ${serviceName}.`;
            category = 'appointments';
            break;
        }
        case 'appointment.updated': {
            message = `An appointment has been updated.`;
            if (details.status) message = `Appointment status changed to "${details.status}".`;
            category = 'appointments';
            break;
        }
        case 'appointment.deleted': {
            message = `An appointment has been cancelled and removed.`;
            category = 'appointments';
            break;
        }
        case 'service.created': {
            const svcName = details.name || 'A new service';
            message = `A new service "${svcName}" has been created.`;
            category = 'event_types';
            break;
        }
        case 'service.updated': {
            const updateAction = details.action || 'updated';
            if (updateAction === 'assign_staff') {
                message = `Staff assignments updated for a service. ${details.added_staff_ids?.length || 0} staff added.`;
            } else if (updateAction === 'unassign_staff') {
                message = `Staff removed from a service.`;
            } else if (updateAction === 'replace_staff') {
                message = `Staff assignments replaced for a service. ${details.new_staff_ids?.length || 0} staff assigned.`;
            } else {
                message = `A service has been updated.`;
            }
            category = 'event_types';
            break;
        }
        case 'service.deleted': {
            message = `A service has been deleted.`;
            category = 'event_types';
            break;
        }
        case 'customer.created': {
            const custName = details.name || details.email || 'A new customer';
            message = `You have a new customer, ${custName}.`;
            category = 'users';
            break;
        }
        case 'customer.deleted': {
            message = `A customer has been removed.`;
            category = 'users';
            break;
        }
        case 'user.created': {
            const userName = details.display_name || details.email || 'A new user';
            message = `New employee "${userName}" has been added to the workspace.`;
            category = 'users';
            break;
        }
        case 'user.updated': {
            message = `An employee profile has been updated.`;
            category = 'users';
            break;
        }
        case 'user.removed': {
            message = `An employee has been removed from the workspace.`;
            category = 'users';
            break;
        }
        case 'organization.setup': {
            message = `Organization setup completed successfully.`;
            category = 'system';
            break;
        }
        case 'workspace.created': {
            message = `A new workspace has been created.`;
            category = 'system';
            break;
        }
        default: {
            // Generic fallback
            message = `Activity: ${action.replace(/\./g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`;
            category = 'system';
        }
    }

    return {
        id: log.ROWID || log.log_id,
        category,
        message,
        action,
        resource_type: log.resource_type || '',
        resource_id: log.resource_id || '',
        timestamp: log.created_at || '',
        user_id: log.user_id || '',
        details,
    };
};

/**
 * GET / — Get notifications for the current workspace.
 * Returns AuditLog entries transformed into notification format.
 * Supports ?limit=N and ?category=appointments|users|event_types|system
 */
router.get('/', requirePermission('appointments.read'), asyncHandler(async (req, res) => {
    const wsId = req.workspaceId;
    const limit = parseInt(req.query.limit) || 50;
    const category = req.query.category || 'all';

    // Fetch audit logs for this workspace, ordered by most recent first
    let query = `SELECT * FROM ${TABLES.AUDIT_LOG} WHERE workspace_id = '${wsId}' ORDER BY created_at DESC LIMIT ${limit}`;
    
    let logs = [];
    try {
        const result = await executeWorkspaceScopedZCQL(req, query);
        logs = result.map(row => row.AuditLog || row);
    } catch (err) {
        // If workspace_id filter returns nothing, try fuzzy matching
        console.warn('[Notifications] Primary query failed, trying fallback:', err.message);
        try {
            const allLogs = await executeZCQL(req, `SELECT * FROM ${TABLES.AUDIT_LOG} ORDER BY created_at DESC LIMIT ${limit * 2}`);
            const targetWsId = parseInt(String(wsId), 10);
            logs = allLogs
                .map(row => row.AuditLog || row)
                .filter(log => {
                    const logWsId = parseInt(String(log.workspace_id), 10);
                    return !isNaN(logWsId) && !isNaN(targetWsId) && Math.abs(logWsId - targetWsId) <= 10;
                })
                .slice(0, limit);
        } catch (fallbackErr) {
            console.error('[Notifications] Fallback query also failed:', fallbackErr.message);
        }
    }

    // Transform to notifications
    let notifications = logs.map(transformAuditToNotification);

    // Filter by category if specified
    if (category !== 'all') {
        notifications = notifications.filter(n => n.category === category);
    }

    // Get the user's last-read timestamp from WorkspaceSettings
    let lastReadAt = null;
    try {
        const userId = req.user?.user_id || '';
        const settingKey = `notif_last_read_${userId}`;
        const settingResult = await executeWorkspaceScopedZCQL(req,
            `SELECT setting_value FROM ${TABLES.WORKSPACE_SETTINGS} WHERE workspace_id = '${wsId}' AND setting_key = '${settingKey}'`
        );
        if (settingResult.length > 0) {
            lastReadAt = (settingResult[0].WorkspaceSettings || settingResult[0]).setting_value;
        }
    } catch (err) {
        // WorkspaceSettings might not have any rows yet — that's fine
    }

    // Mark notifications as read/unread based on lastReadAt
    if (lastReadAt) {
        const lastReadTime = new Date(lastReadAt).getTime();
        notifications = notifications.map(n => ({
            ...n,
            read: n.timestamp ? new Date(n.timestamp).getTime() <= lastReadTime : true,
        }));
    } else {
        // If no last-read timestamp, mark all as unread
        notifications = notifications.map(n => ({ ...n, read: false }));
    }

    const unreadCount = notifications.filter(n => !n.read).length;

    return response.success(res, {
        notifications,
        unreadCount,
        total: notifications.length,
        lastReadAt,
    });
}));

/**
 * POST /mark-read — Mark all notifications as read for the current user.
 * Stores the current timestamp in WorkspaceSettings.
 */
router.post('/mark-read', requirePermission('appointments.read'), asyncHandler(async (req, res) => {
    const wsId = req.workspaceId;
    const userId = req.user?.user_id || '';
    const settingKey = `notif_last_read_${userId}`;
    const now = catalystDateTime();

    const datastore = getDatastore(req);

    // Check if the setting already exists
    try {
        const existing = await executeWorkspaceScopedZCQL(req,
            `SELECT ROWID FROM ${TABLES.WORKSPACE_SETTINGS} WHERE workspace_id = '${wsId}' AND setting_key = '${settingKey}'`
        );

        if (existing.length > 0) {
            // Update existing row
            const rowId = (existing[0].WorkspaceSettings || existing[0]).ROWID;
            await datastore.table(TABLES.WORKSPACE_SETTINGS).updateRow({
                ROWID: rowId,
                setting_value: now,
            });
        } else {
            // Insert new row
            const toBigInt = (v) => {
                if (!v) return 0;
                const p = parseInt(String(v), 10);
                return isNaN(p) ? 0 : p;
            };
            await datastore.table(TABLES.WORKSPACE_SETTINGS).insertRow({
                setting_id: Date.now(),
                workspace_id: toBigInt(wsId),
                setting_key: settingKey,
                setting_value: now,
            });
        }
    } catch (err) {
        console.error('[Notifications] Failed to mark-read:', err.message);
        // Non-critical — don't fail the request
    }

    return response.success(res, { markedReadAt: now });
}));

/**
 * GET /unread-count — Get just the unread notification count (lightweight endpoint for polling).
 */
router.get('/unread-count', requirePermission('appointments.read'), asyncHandler(async (req, res) => {
    const wsId = req.workspaceId;
    const userId = req.user?.user_id || '';
    const settingKey = `notif_last_read_${userId}`;

    // Get last-read timestamp
    let lastReadAt = null;
    try {
        const settingResult = await executeWorkspaceScopedZCQL(req,
            `SELECT setting_value FROM ${TABLES.WORKSPACE_SETTINGS} WHERE workspace_id = '${wsId}' AND setting_key = '${settingKey}'`
        );
        if (settingResult.length > 0) {
            lastReadAt = (settingResult[0].WorkspaceSettings || settingResult[0]).setting_value;
        }
    } catch { /* ignore */ }

    // Count audit logs after lastReadAt
    let unreadCount = 0;
    try {
        let countQuery;
        if (lastReadAt) {
            countQuery = `SELECT ROWID FROM ${TABLES.AUDIT_LOG} WHERE workspace_id = '${wsId}' AND created_at > '${lastReadAt}'`;
        } else {
            countQuery = `SELECT ROWID FROM ${TABLES.AUDIT_LOG} WHERE workspace_id = '${wsId}'`;
        }
        const result = await executeWorkspaceScopedZCQL(req, countQuery);
        unreadCount = result.length;
    } catch {
        // Fallback: return 0 if query fails
    }

    return response.success(res, { unreadCount });
}));

module.exports = router;
