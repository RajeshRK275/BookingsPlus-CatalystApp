/**
 * Application-Wide Constants
 * Single source of truth for magic strings, table names, and default values.
 */

// ── Catalyst Datastore Table Names ──
const TABLES = Object.freeze({
    ORGANIZATION: 'Organization',
    WORKSPACES: 'Workspaces',
    USERS: 'Users',
    USER_WORKSPACES: 'UserWorkspaces',
    PERMISSIONS: 'Permissions',
    ROLES: 'Roles',
    ROLE_PERMISSIONS: 'RolePermissions',
    USER_ROLE_MAPPING: 'UserRoleMapping',
    SERVICES: 'Services',
    STAFF: 'Staff',
    AVAILABILITY: 'Availability',
    CUSTOMERS: 'Customers',
    APPOINTMENTS: 'Appointments',
    APPOINTMENT_APPROVALS: 'Appointment_Approvals',
    INTEGRATIONS: 'Integrations',
    SERVICE_STAFF: 'ServiceStaff',
    AUDIT_LOG: 'AuditLog',
    WORKSPACE_SETTINGS: 'WorkspaceSettings',
});

// ── Workspace-Scoped Tables (require workspace_id in queries) ──
const WORKSPACE_SCOPED_TABLES = Object.freeze([
    TABLES.SERVICES, TABLES.STAFF, TABLES.AVAILABILITY, TABLES.CUSTOMERS,
    TABLES.APPOINTMENTS, TABLES.APPOINTMENT_APPROVALS, TABLES.INTEGRATIONS,
    TABLES.SERVICE_STAFF, TABLES.ROLES, TABLES.ROLE_PERMISSIONS,
    TABLES.WORKSPACE_SETTINGS, TABLES.USER_WORKSPACES,
]);

// ── Status Constants ──
const STATUS = Object.freeze({
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    SUSPENDED: 'suspended',
    ARCHIVED: 'archived',
    DEACTIVATED: 'deactivated',
    PENDING: 'pending',
});

// ── Appointment Statuses ──
const APPOINTMENT_STATUS = Object.freeze({
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    CANCELLED: 'cancelled',
    COMPLETED: 'completed',
    NO_SHOW: 'no_show',
});

// ── Approval Statuses ──
const APPROVAL_STATUS = Object.freeze({
    AWAITING: 'awaiting_approval',
    APPROVED: 'approved',
    REJECTED: 'rejected',
});

// ── Payment Statuses ──
const PAYMENT_STATUS = Object.freeze({
    UNPAID: 'unpaid',
    PAID: 'paid',
    REFUNDED: 'refunded',
});

// ── Default Role Levels ──
const ROLE_LEVELS = Object.freeze({
    SUPER_ADMIN: 100,
    OWNER: 99,
    ADMIN: 50,
    MANAGER: 10,
    STAFF: 0,
});

// ── Default Role Names ──
const SYSTEM_ROLES = Object.freeze(['Owner', 'Admin', 'Manager', 'Staff']);

// ── Audit Log Actions ──
const AUDIT_ACTIONS = Object.freeze({
    // Organization
    ORG_SETUP: 'organization.setup',
    ORG_UPDATED: 'organization.updated',
    // Workspace
    WS_CREATED: 'workspace.created',
    WS_UPDATED: 'workspace.updated',
    WS_SUSPENDED: 'workspace.suspended',
    WS_ACTIVATED: 'workspace.activated',
    WS_DELETED: 'workspace.deleted',
    // Service
    SVC_CREATED: 'service.created',
    SVC_UPDATED: 'service.updated',
    SVC_DELETED: 'service.deleted',
    // User
    USER_CREATED: 'user.created',
    USER_UPDATED: 'user.updated',
    USER_REMOVED: 'user.removed',
    USER_INVITED: 'user.invited',
    USER_SUPER_ADMIN_TOGGLED: 'user.super_admin_toggled',
    USER_ROLE_SYNCED: 'user.role_synced',
    // Appointment
    APT_CREATED: 'appointment.created',
    APT_UPDATED: 'appointment.updated',
    APT_DELETED: 'appointment.deleted',
    APT_APPROVED: 'appointment.approved',
    // Role
    ROLE_CREATED: 'role.created',
    ROLE_UPDATED: 'role.updated',
    ROLE_DELETED: 'role.deleted',
});

// ── Service Types ──
const SERVICE_TYPES = Object.freeze({
    ONE_ON_ONE: 'one-on-one',
    GROUP: 'group',
    COLLECTIVE: 'collective',
    RESOURCE: 'resource',
});

// ── Default Colors ──
const DEFAULTS = Object.freeze({
    BRAND_COLOR: '#5C44B5',
    USER_COLOR: '#E0E7FF',
    TIMEZONE: 'UTC',
    CURRENCY: 'USD',
    SUBSCRIPTION_PLAN: 'enterprise',
});

module.exports = {
    TABLES,
    WORKSPACE_SCOPED_TABLES,
    STATUS,
    APPOINTMENT_STATUS,
    APPROVAL_STATUS,
    PAYMENT_STATUS,
    ROLE_LEVELS,
    SYSTEM_ROLES,
    AUDIT_ACTIONS,
    SERVICE_TYPES,
    DEFAULTS,
};
