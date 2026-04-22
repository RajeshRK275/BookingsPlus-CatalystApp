/**
 * Frontend Application Constants
 * Single source of truth for magic strings, mock data, and configuration.
 */

// ── Mock Staff Data (will be replaced by API data in production) ──
export const MOCK_STAFF = [
    { id: 1, name: 'Jason Miller' },
    { id: 2, name: 'Emily Carter' },
    { id: 3, name: 'Michael Thompson' },
    { id: 4, name: 'Sarah Johnson' },
    { id: 5, name: 'David Wilson' },
];

// ── Service Types ──
export const SERVICE_TYPES = {
    ONE_ON_ONE: 'one-on-one',
    GROUP: 'group',
    COLLECTIVE: 'collective',
    RESOURCE: 'resource',
};

// ── Avatar Colors ──
export const AVATAR_COLORS = ['#C4B5FD', '#6EE7B7', '#FCA5A5', '#93C5FD', '#FDBA74'];

// ── Month Names ──
export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTH_NAMES_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ── Status Badge Config ──
export const STATUS_STYLES = {
    upcoming: { bg: '#FEF3C7', color: '#92400E', label: 'Upcoming' },
    completed: { bg: '#DCFCE7', color: '#166534', label: 'Completed' },
    cancelled: { bg: '#FEE2E2', color: '#991B1B', label: 'Cancelled' },
    pending: { bg: '#F3F0FF', color: '#5C44B5', label: 'Pending' },
    active: { bg: '#DCFCE7', color: '#166534', label: 'Active' },
    inactive: { bg: '#F3F4F6', color: '#6B7280', label: 'Inactive' },
};

// ── LocalStorage Keys ──
export const STORAGE_KEYS = {
    ACTIVE_WORKSPACE: 'bp_active_workspace',
    APPOINTMENTS: 'bp_appointments',
    SERVICES: 'bp_services',
    EMPLOYEES: 'bp_employees',
    CUSTOMERS: 'bp_customers',
};

// ── Permissions ──
export const PERMISSIONS = {
    DASHBOARD_READ: 'dashboard.read',
    SERVICES_CREATE: 'services.create',
    SERVICES_READ: 'services.read',
    SERVICES_UPDATE: 'services.update',
    SERVICES_DELETE: 'services.delete',
    APPOINTMENTS_CREATE: 'appointments.create',
    APPOINTMENTS_READ: 'appointments.read',
    APPOINTMENTS_UPDATE: 'appointments.update',
    APPOINTMENTS_DELETE: 'appointments.delete',
    APPOINTMENTS_APPROVE: 'appointments.approve',
    USERS_CREATE: 'users.create',
    USERS_READ: 'users.read',
    USERS_UPDATE: 'users.update',
    USERS_DELETE: 'users.delete',
    CUSTOMERS_CREATE: 'customers.create',
    CUSTOMERS_READ: 'customers.read',
    SETTINGS_READ: 'settings.read',
    SETTINGS_UPDATE: 'settings.update',
    ROLES_MANAGE: 'roles.manage',
    AUDIT_READ: 'audit.read',
};
