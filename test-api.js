/**
 * BookingsPlus — Full API Test Suite
 * 
 * Tests every CREATE API in the correct flow:
 *   1. Start dev server (port 5000)
 *   2. GET  /server/health                        — server alive check
 *   3. GET  /api/v1/auth/me                       — get current user
 *   4. POST /api/v1/organizations/setup           — setup org + workspace + roles + permissions
 *   5. GET  /api/v1/auth/me                       — verify setup_completed = true
 *   6. GET  /api/v1/workspaces/my-workspaces      — list workspaces, capture workspaceId
 *   7. POST /api/v1/users (workspace-scoped)      — create user (staff member)
 *   8. POST /api/v1/services (workspace-scoped)   — create service
 *   9. POST /api/v1/appointments/book             — book appointment
 *  10. GET  /api/v1/users                         — list users
 *  11. GET  /api/v1/services                      — list services
 *  12. GET  /api/v1/appointments                  — list appointments
 *  13. POST /api/v1/admin/:wsId/roles             — admin: create custom role
 *  14. POST /api/v1/admin/users/invite            — admin: invite user
 *  15. GET  /server/debug/db                      — dump full in-memory DB
 * 
 * Run: node test-api.js
 */

'use strict';

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

// ── Configuration ──────────────────────────────────────────────────
const BASE      = 'http://127.0.0.1:5000';
const API       = `${BASE}/server/bookingsplus/api/v1`;
const ADMIN_SECRET = 'bp-admin-secret-dev';

// ANSI colours
const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const BOLD   = '\x1b[1m';
const DIM    = '\x1b[2m';
const RESET  = '\x1b[0m';

// State shared between tests
const state = {
    workspaceId: null,
    userId: null,
    serviceId: null,
    appointmentId: null,
    customRoleId: null,
    ownerRoleId: null,
};

let passed = 0;
let failed = 0;
let total  = 0;

// ── HTTP helper ────────────────────────────────────────────────────
function request(method, url, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || 80,
            path: urlObj.pathname + urlObj.search,
            method,
            headers: {
                'Content-Type': 'application/json',
                ...headers,
            },
        };

        const payload = body ? JSON.stringify(body) : null;
        if (payload) options.headers['Content-Length'] = Buffer.byteLength(payload);

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(data) });
                } catch {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });

        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

// ── Test runner ────────────────────────────────────────────────────
async function test(name, fn) {
    total++;
    process.stdout.write(`  ${DIM}[${total}]${RESET} ${name} ... `);
    try {
        const result = await fn();
        passed++;
        console.log(`${GREEN}✓ PASS${RESET}`);
        if (result && typeof result === 'object' && result._log) {
            console.log(`       ${DIM}${result._log}${RESET}`);
        }
    } catch (err) {
        failed++;
        console.log(`${RED}✗ FAIL${RESET}`);
        console.log(`       ${RED}${err.message}${RESET}`);
    }
}

function assert(condition, msg) {
    if (!condition) throw new Error(msg);
}

// ── Wait for server ────────────────────────────────────────────────
function waitForServer(retries = 30, delay = 500) {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const check = () => {
            request('GET', `${BASE}/server/health`)
                .then(res => {
                    if (res.status === 200) resolve();
                    else retry();
                })
                .catch(() => retry());
        };
        const retry = () => {
            if (++attempts >= retries) return reject(new Error('Server did not start in time.'));
            setTimeout(check, delay);
        };
        check();
    });
}

// ── Print table of DB contents ─────────────────────────────────────
function printDBTable(tableName, rows) {
    if (!rows || rows.length === 0) {
        console.log(`     ${DIM}(empty)${RESET}`);
        return;
    }
    const keys = Object.keys(rows[0]).slice(0, 6); // show max 6 cols
    const header = keys.map(k => k.padEnd(20)).join('│');
    console.log(`     ${CYAN}${header}${RESET}`);
    console.log(`     ${DIM}${'─'.repeat(header.length)}${RESET}`);
    rows.forEach(row => {
        const line = keys.map(k => String(row[k] ?? '').slice(0, 19).padEnd(20)).join('│');
        console.log(`     ${line}`);
    });
}

// ══════════════════════════════════════════════════════════════════
// MAIN TEST SUITE
// ══════════════════════════════════════════════════════════════════
async function runTests() {
    console.log(`\n${BOLD}${CYAN}╔══════════════════════════════════════════════════╗${RESET}`);
    console.log(`${BOLD}${CYAN}║    BookingsPlus — Full API Test Suite             ║${RESET}`);
    console.log(`${BOLD}${CYAN}╚══════════════════════════════════════════════════╝${RESET}\n`);

    // ─────────────────────────────────────────────────────────────
    // SECTION 1: Server Health
    // ─────────────────────────────────────────────────────────────
    console.log(`${BOLD}── 1. SERVER HEALTH ──────────────────────────────────${RESET}`);

    await test('GET /server/health → 200 with table list', async () => {
        const { status, body } = await request('GET', `${BASE}/server/health`);
        assert(status === 200, `Expected 200, got ${status}`);
        assert(body.status === 'ok', `Expected status=ok, got ${body.status}`);
        assert(Array.isArray(body.tables), 'Expected tables array');
        return { _log: `Tables: ${body.tables.slice(0, 4).join(', ')} ...` };
    });

    // ─────────────────────────────────────────────────────────────
    // SECTION 2: Auth — /me
    // ─────────────────────────────────────────────────────────────
    console.log(`\n${BOLD}── 2. AUTH (/me) ─────────────────────────────────────${RESET}`);

    await test('GET /auth/me → returns dev user', async () => {
        const { status, body } = await request('GET', `${API}/auth/me`);
        assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
        assert(body.success === true, `Expected success=true`);
        assert(body.data.user.email === 'admin@bookingsplus.dev', `Unexpected email: ${body.data.user.email}`);
        assert(body.data.setupCompleted === false, 'Setup should not be completed yet');
        return { _log: `user: ${body.data.user.email}, setupCompleted: ${body.data.setupCompleted}` };
    });

    await test('GET /auth/me/permissions (no workspace) → 200 for super admin', async () => {
        const { status, body } = await request('GET', `${API}/auth/me/permissions`);
        assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
        assert(body.data.is_super_admin === true, 'Expected is_super_admin=true');
        // Super admin returns all seeded permissions (25). Before org setup they return 0 which is fine.
        return { _log: `is_super_admin=true, permissions=${body.data.permissions.length}` };
    });

    // ─────────────────────────────────────────────────────────────
    // SECTION 3: Organization Setup
    // ─────────────────────────────────────────────────────────────
    console.log(`\n${BOLD}── 3. ORGANIZATION SETUP ─────────────────────────────${RESET}`);

    await test('POST /organizations/setup → creates org, workspace, roles, permissions', async () => {
        const payload = {
            organization_name: 'Acme Booking Co.',
            org_slug: 'acme-booking-co',
            timezone: 'America/New_York',
            currency: 'USD',
            workspace_name: 'Main Office',
            workspace_slug: 'main-office',
        };
        const { status, body } = await request('POST', `${API}/organizations/setup`, payload);
        assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
        assert(body.success === true, `Expected success=true: ${body.message}`);
        assert(body.data.organization, 'Expected organization in response');
        assert(body.data.workspace, 'Expected workspace in response');
        state.workspaceId = String(body.data.workspace.ROWID);
        return { _log: `workspaceId=${state.workspaceId}, org="${body.data.organization.org_name}"` };
    });

    await test('POST /organizations/setup again → 409 ConflictError', async () => {
        const { status, body } = await request('POST', `${API}/organizations/setup`, {
            organization_name: 'Duplicate Org',
        });
        assert(status === 409, `Expected 409, got ${status}: ${JSON.stringify(body)}`);
        return { _log: `Conflict correctly detected: ${body.message}` };
    });

    await test('GET /organizations → setup_completed = true', async () => {
        const { status, body } = await request('GET', `${API}/organizations`);
        assert(status === 200, `Expected 200, got ${status}`);
        assert(body.data.data.org_name === 'Acme Booking Co.', 'Org name mismatch');
        assert(body.data.data.setup_completed === 'true', 'setup_completed should be true');
        return { _log: `org_name="${body.data.data.org_name}", slug="${body.data.data.org_slug}"` };
    });

    // ─────────────────────────────────────────────────────────────
    // SECTION 4: Auth — verify setup after org created
    // ─────────────────────────────────────────────────────────────
    console.log(`\n${BOLD}── 4. AUTH AFTER SETUP ───────────────────────────────${RESET}`);

    await test('GET /auth/me → setupCompleted = true, has workspace', async () => {
        const { status, body } = await request('GET', `${API}/auth/me`);
        assert(status === 200, `Expected 200, got ${status}`);
        assert(body.data.setupCompleted === true, `Expected setupCompleted=true`);
        assert(body.data.workspaces.length > 0, 'Expected at least 1 workspace');
        return { _log: `workspaces: ${body.data.workspaces.map(w => w.workspace_name).join(', ')}` };
    });

    await test('GET /auth/me/permissions with X-Workspace-Id → super admin gets all perms', async () => {
        const { status, body } = await request('GET', `${API}/auth/me/permissions`, null, {
            'x-workspace-id': state.workspaceId,
        });
        assert(status === 200, `Expected 200, got ${status}`);
        assert(body.data.permissions.length >= 25, `Expected ≥25 perms, got ${body.data.permissions.length}`);
        return { _log: `permissions: ${body.data.permissions.length} (all granted as super admin)` };
    });

    // ─────────────────────────────────────────────────────────────
    // SECTION 5: Workspaces
    // ─────────────────────────────────────────────────────────────
    console.log(`\n${BOLD}── 5. WORKSPACES ─────────────────────────────────────${RESET}`);

    await test('GET /workspaces/my-workspaces → returns workspaces list', async () => {
        const { status, body } = await request('GET', `${API}/workspaces/my-workspaces`);
        assert(status === 200, `Expected 200, got ${status}`);
        assert(Array.isArray(body.data), 'Expected array');
        assert(body.data.length > 0, 'Expected at least 1 workspace');
        const ws = body.data[0];
        assert(ws.workspace_name, 'Expected workspace_name');
        return { _log: `workspace: "${ws.workspace_name}", slug="${ws.workspace_slug}", role="${ws.role_name}"` };
    });

    await test('GET /workspaces/:id → returns workspace details', async () => {
        const { status, body } = await request('GET', `${API}/workspaces/${state.workspaceId}`);
        assert(status === 200, `Expected 200, got ${status}`);
        assert(body.data.workspace_name === 'Main Office', `Expected "Main Office", got "${body.data.workspace_name}"`);
        return { _log: `workspace: "${body.data.workspace_name}", status="${body.data.status}"` };
    });

    await test('GET /workspaces/by-slug/main-office → returns workspace by slug', async () => {
        const { status, body } = await request('GET', `${API}/workspaces/by-slug/main-office`);
        assert(status === 200, `Expected 200, got ${status}`);
        assert(body.data.workspace_slug === 'main-office', 'Slug mismatch');
        return { _log: `found workspace by slug: "${body.data.workspace_name}"` };
    });

    // ─────────────────────────────────────────────────────────────
    // SECTION 6: Users (workspace-scoped)
    // ─────────────────────────────────────────────────────────────
    console.log(`\n${BOLD}── 6. USERS (Workspace-Scoped) ───────────────────────${RESET}`);

    await test('POST /users → create staff user with ALL fields', async () => {
        const payload = {
            display_name: 'Jane Smith',
            name: 'Jane Smith',
            email: 'jane.smith@acmebooking.com',
            phone: '+1-555-867-5309',
            designation: 'Senior Consultant',
            gender: 'female',
            dob: '1990-06-15',
            color: '#4F46E5',
            initials: 'JS',
            status: 'active',
        };
        const { status, body } = await request('POST', `${API}/users`, payload, {
            'x-workspace-id': state.workspaceId,
        });
        assert(status === 201, `Expected 201, got ${status}: ${JSON.stringify(body)}`);
        assert(body.success === true, `Expected success=true: ${body.message}`);
        state.userId = String(body.data.user_id);
        return { _log: `userId=${state.userId}, email="${body.data.email}"` };
    });

    await test('POST /users duplicate email → 409 ConflictError', async () => {
        const { status } = await request('POST', `${API}/users`, {
            email: 'jane.smith@acmebooking.com',
            display_name: 'Jane Duplicate',
        }, { 'x-workspace-id': state.workspaceId });
        assert(status === 409, `Expected 409, got ${status}`);
        return { _log: 'Duplicate user correctly rejected' };
    });

    await test('POST /users → create second user (Manager)', async () => {
        const payload = {
            display_name: 'Bob Manager',
            email: 'bob.manager@acmebooking.com',
            phone: '+1-555-222-3344',
            designation: 'Office Manager',
            gender: 'male',
            dob: '1985-03-22',
            color: '#F59E0B',
            initials: 'BM',
        };
        const { status, body } = await request('POST', `${API}/users`, payload, {
            'x-workspace-id': state.workspaceId,
        });
        assert(status === 201, `Expected 201, got ${status}: ${JSON.stringify(body)}`);
        return { _log: `2nd user created: "${body.data.email}"` };
    });

    await test('GET /users → lists workspace users', async () => {
        const { status, body } = await request('GET', `${API}/users`, null, {
            'x-workspace-id': state.workspaceId,
        });
        assert(status === 200, `Expected 200, got ${status}`);
        assert(Array.isArray(body.data), 'Expected array');
        return { _log: `users in workspace: ${body.data.length}` };
    });

    await test('PUT /users/:id → update user designation', async () => {
        const { status, body } = await request('PUT', `${API}/users/${state.userId}`, {
            designation: 'Lead Consultant',
            phone: '+1-555-000-1111',
        }, { 'x-workspace-id': state.workspaceId });
        assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
        return { _log: 'User updated successfully' };
    });

    // ─────────────────────────────────────────────────────────────
    // SECTION 7: Services (workspace-scoped)
    // ─────────────────────────────────────────────────────────────
    console.log(`\n${BOLD}── 7. SERVICES (Workspace-Scoped) ────────────────────${RESET}`);

    await test('POST /services → create service with ALL fields', async () => {
        const payload = {
            service_name: 'Business Strategy Consultation',
            description: 'One-hour deep-dive into your business strategy and growth planning.',
            duration_minutes: 60,
            price: 150.00,
            service_type: 'one-on-one',
            meeting_mode: 'Online',
            meeting_location: 'Google Meet — link sent on confirmation',
            seats: 1,
        };
        const { status, body } = await request('POST', `${API}/services`, payload, {
            'x-workspace-id': state.workspaceId,
        });
        assert(status === 201, `Expected 201, got ${status}: ${JSON.stringify(body)}`);
        assert(body.success === true, `Expected success=true: ${body.message}`);
        state.serviceId = body.data.service_id || body.data.ROWID;
        return { _log: `serviceId=${state.serviceId}, name="${body.data.service_name}"` };
    });

    await test('POST /services → create group service', async () => {
        const payload = {
            service_name: 'Team Workshop: Agile Fundamentals',
            description: 'Half-day group workshop on Agile and Scrum practices for teams up to 10.',
            duration_minutes: 240,
            price: 800.00,
            service_type: 'group',
            meeting_mode: 'In-Person',
            meeting_location: '123 Main St, New York, NY 10001',
            seats: 10,
        };
        const { status, body } = await request('POST', `${API}/services`, payload, {
            'x-workspace-id': state.workspaceId,
        });
        assert(status === 201, `Expected 201, got ${status}: ${JSON.stringify(body)}`);
        return { _log: `group service: "${body.data.service_name}", seats=${body.data.seats}` };
    });

    await test('POST /services → create resource/collective service', async () => {
        const payload = {
            service_name: 'Conference Room Booking',
            description: 'Reserve the main conference room for internal meetings.',
            duration_minutes: 60,
            price: 0,
            service_type: 'resource',
            meeting_mode: 'In-Person',
            meeting_location: 'Floor 3 — Room A',
            seats: 15,
        };
        const { status, body } = await request('POST', `${API}/services`, payload, {
            'x-workspace-id': state.workspaceId,
        });
        assert(status === 201, `Expected 201, got ${status}: ${JSON.stringify(body)}`);
        return { _log: `resource service created: "${body.data.service_name}"` };
    });

    await test('GET /services → lists all workspace services', async () => {
        const { status, body } = await request('GET', `${API}/services`, null, {
            'x-workspace-id': state.workspaceId,
        });
        assert(status === 200, `Expected 200, got ${status}`);
        assert(Array.isArray(body.data), 'Expected array');
        assert(body.data.length >= 3, `Expected ≥3 services, got ${body.data.length}`);
        return { _log: `services count: ${body.data.length}` };
    });

    await test('PUT /services/:id → update service price', async () => {
        const { status, body } = await request('PUT', `${API}/services/${state.serviceId}`, {
            price: 175.00,
            description: 'Updated: Premium one-hour strategy session.',
        }, { 'x-workspace-id': state.workspaceId });
        assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
        return { _log: `Service updated, new price: 175.00` };
    });

    // ─────────────────────────────────────────────────────────────
    // SECTION 8: Appointments (workspace-scoped)
    // ─────────────────────────────────────────────────────────────
    console.log(`\n${BOLD}── 8. APPOINTMENTS (Workspace-Scoped) ────────────────${RESET}`);

    await test('POST /appointments/book → book appointment with ALL fields', async () => {
        const payload = {
            service_id: state.serviceId,
            service_name: 'Business Strategy Consultation',
            staff_id: state.userId,
            staff_name: 'Jane Smith',
            customer_id: 'cust-001',
            customer_name: 'Charlie Client',
            start_time: '2025-08-15T14:00:00.000Z',
            end_time: '2025-08-15T15:00:00.000Z',
            notes: 'Discuss Q3 growth strategy, marketing budget, and new product roadmap.',
        };
        const { status, body } = await request('POST', `${API}/appointments/book`, payload, {
            'x-workspace-id': state.workspaceId,
        });
        assert(status === 201, `Expected 201, got ${status}: ${JSON.stringify(body)}`);
        assert(body.success === true, `Expected success=true: ${body.message}`);
        state.appointmentId = body.data.appointment_id || body.data.ROWID;
        return { _log: `appointmentId=${state.appointmentId}, status="${body.data.appointment_status}"` };
    });

    await test('POST /appointments/book → second appointment (group service)', async () => {
        const payload = {
            service_id: 'svc-workshop',
            service_name: 'Team Workshop: Agile Fundamentals',
            staff_id: state.userId,
            staff_name: 'Jane Smith',
            customer_id: 'cust-002',
            customer_name: 'Diana Developer',
            start_time: '2025-08-20T09:00:00.000Z',
            end_time: '2025-08-20T13:00:00.000Z',
            notes: 'Full dev team attending. 8 participants confirmed.',
        };
        const { status, body } = await request('POST', `${API}/appointments/book`, payload, {
            'x-workspace-id': state.workspaceId,
        });
        assert(status === 201, `Expected 201, got ${status}: ${JSON.stringify(body)}`);
        return { _log: `2nd appointment: customer="${body.data.customer_name}", service="${body.data.service_name}"` };
    });

    await test('GET /appointments → lists all workspace appointments', async () => {
        const { status, body } = await request('GET', `${API}/appointments`, null, {
            'x-workspace-id': state.workspaceId,
        });
        assert(status === 200, `Expected 200, got ${status}`);
        assert(Array.isArray(body.data), 'Expected array');
        assert(body.data.length >= 2, `Expected ≥2 appointments, got ${body.data.length}`);
        return { _log: `appointments count: ${body.data.length}` };
    });

    await test('PUT /appointments/:id → update appointment status to confirmed', async () => {
        const { status, body } = await request('PUT', `${API}/appointments/${state.appointmentId}`, {
            appointment_status: 'confirmed',
            approval_status: 'approved',
            payment_status: 'paid',
        }, { 'x-workspace-id': state.workspaceId });
        assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
        return { _log: `Appointment updated: status=confirmed, payment=paid` };
    });

    // ─────────────────────────────────────────────────────────────
    // SECTION 9: Admin — Roles
    // Route mount: /api/v1/admin/roles → admin.roles.routes.js
    //   GET    /api/v1/admin/roles/:wsId/roles       → list roles for workspace
    //   POST   /api/v1/admin/roles/:wsId/roles       → create role for workspace
    //   PUT    /api/v1/admin/roles/roles/:roleId     → update role
    //   DELETE /api/v1/admin/roles/roles/:roleId     → delete role
    // ─────────────────────────────────────────────────────────────
    console.log(`\n${BOLD}── 9. ADMIN — ROLES ──────────────────────────────────${RESET}`);

    await test('GET /admin/roles/:wsId/roles → lists all seeded roles (4 system roles)', async () => {
        const { status, body } = await request('GET', `${API}/admin/roles/${state.workspaceId}/roles`);
        assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
        assert(Array.isArray(body.data), 'Expected array');
        assert(body.data.length >= 4, `Expected ≥4 roles (Owner/Admin/Manager/Staff), got ${body.data.length}`);
        const roleNames = body.data.map(r => r.role_name);
        assert(roleNames.includes('Owner'), 'Expected Owner role');
        assert(roleNames.includes('Admin'), 'Expected Admin role');
        assert(roleNames.includes('Manager'), 'Expected Manager role');
        assert(roleNames.includes('Staff'), 'Expected Staff role');
        // Capture Owner role ID for later
        const ownerRole = body.data.find(r => r.role_name === 'Owner');
        state.ownerRoleId = ownerRole?.ROWID || ownerRole?.id;
        return { _log: `roles: ${roleNames.join(', ')}` };
    });

    await test('POST /admin/roles/:wsId/roles → create custom "Receptionist" role', async () => {
        const { status, body } = await request('POST', `${API}/admin/roles/${state.workspaceId}/roles`, {
            role_name: 'Receptionist',
            role_level: 5,
            description: 'Front-desk staff: manage walk-in bookings and customer check-in',
        });
        assert(status === 201, `Expected 201, got ${status}: ${JSON.stringify(body)}`);
        state.customRoleId = body.data.ROWID;
        return { _log: `custom role created: "${body.data.role_name}", level=${body.data.role_level}` };
    });

    await test('PUT /admin/roles/roles/:roleId → update custom role description', async () => {
        const { status, body } = await request('PUT', `${API}/admin/roles/roles/${state.customRoleId}`, {
            description: 'Updated: Front-desk staff with scheduling privileges',
            role_level: 8,
        });
        assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
        return { _log: `Role updated: level=8` };
    });

    await test('PUT /admin/roles/roles/:roleId (system Owner) → cannot rename system role', async () => {
        // Try to rename Owner role — should be rejected
        const { status, body } = await request('PUT', `${API}/admin/roles/roles/${state.ownerRoleId}`, {
            role_name: 'Hacker',
        });
        assert(status === 403, `Expected 403, got ${status}: ${JSON.stringify(body)}`);
        return { _log: `System role rename correctly rejected: ${body.message}` };
    });

    // ─────────────────────────────────────────────────────────────
    // SECTION 10: Admin — Workspaces
    // Route mount: /api/v1/admin/workspaces → admin.workspaces.routes.js
    // ─────────────────────────────────────────────────────────────
    console.log(`\n${BOLD}── 10. ADMIN — WORKSPACES ────────────────────────────${RESET}`);

    await test('GET /admin/workspaces → lists all workspaces', async () => {
        const { status, body } = await request('GET', `${API}/admin/workspaces`);
        assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
        assert(Array.isArray(body.data), 'Expected array');
        assert(body.data.length >= 1, 'Expected at least 1 workspace');
        return { _log: `workspaces in system: ${body.data.length}` };
    });

    await test('POST /admin/workspaces → create a second workspace with ALL fields', async () => {
        const payload = {
            workspace_name: 'West Coast Office',
            workspace_slug: 'west-coast-office',
            description: 'Operations hub for the Pacific timezone team',
            brand_color: '#10B981',
        };
        const { status, body } = await request('POST', `${API}/admin/workspaces`, payload);
        assert(status === 201, `Expected 201, got ${status}: ${JSON.stringify(body)}`);
        assert(body.data.workspace_name === 'West Coast Office', 'workspace_name mismatch');
        state.secondWorkspaceId = String(body.data.ROWID);
        return { _log: `2nd workspace created: "${body.data.workspace_name}", id=${state.secondWorkspaceId}` };
    });

    await test('POST /admin/workspaces (duplicate slug) → 409 ConflictError', async () => {
        const { status, body } = await request('POST', `${API}/admin/workspaces`, {
            workspace_name: 'West Coast Duplicate',
            workspace_slug: 'west-coast-office',
        });
        assert(status === 409, `Expected 409, got ${status}: ${JSON.stringify(body)}`);
        return { _log: `Duplicate slug correctly rejected: ${body.message}` };
    });

    await test('PUT /admin/workspaces/:id → update workspace brand color', async () => {
        const { status, body } = await request('PUT', `${API}/admin/workspaces/${state.secondWorkspaceId}`, {
            brand_color: '#F59E0B',
            description: 'Updated West Coast hub description',
        });
        assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
        return { _log: `Workspace updated: brand_color=#F59E0B` };
    });

    await test('POST /admin/workspaces/:id/suspend → suspend second workspace', async () => {
        const { status, body } = await request('POST', `${API}/admin/workspaces/${state.secondWorkspaceId}/suspend`);
        assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
        return { _log: `Workspace ${state.secondWorkspaceId} suspended` };
    });

    await test('POST /admin/workspaces/:id/activate → re-activate second workspace', async () => {
        const { status, body } = await request('POST', `${API}/admin/workspaces/${state.secondWorkspaceId}/activate`);
        assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
        return { _log: `Workspace ${state.secondWorkspaceId} re-activated` };
    });

    // ─────────────────────────────────────────────────────────────
    // SECTION 11: Admin — Users
    // ─────────────────────────────────────────────────────────────
    console.log(`\n${BOLD}── 11. ADMIN — USERS ─────────────────────────────────${RESET}`);

    await test('GET /admin/users → lists all users', async () => {
        const { status, body } = await request('GET', `${API}/admin/users`);
        assert(status === 200, `Expected 200, got ${status}`);
        assert(Array.isArray(body.data), 'Expected array');
        return { _log: `total users in system: ${body.data.length}` };
    });

    await test('POST /admin/users/invite → invite new user with ALL fields', async () => {
        const payload = {
            name: 'Eve External',
            email: 'eve.external@partner.com',
            workspace_id: state.workspaceId,
            role_id: state.customRoleId,
        };
        const { status, body } = await request('POST', `${API}/admin/users/invite`, payload);
        assert(status === 201, `Expected 201, got ${status}: ${JSON.stringify(body)}`);
        assert(body.success === true, `Expected success=true: ${body.message}`);
        state.invitedUserId = String(body.data.user_id);
        return { _log: `Invited: "${body.data.email}", userId=${state.invitedUserId}` };
    });

    await test('POST /admin/users/:id/assign-workspace → re-assign user to workspace', async () => {
        const { status, body } = await request('POST', `${API}/admin/users/${state.userId}/assign-workspace`, {
            workspace_id: state.workspaceId,
            role_id: state.ownerRoleId,
        });
        assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
        return { _log: `User ${state.userId} re-assigned to workspace with Owner role` };
    });

    await test('PUT /admin/users/:id/toggle-super-admin → toggle super admin flag', async () => {
        const { status, body } = await request('PUT', `${API}/admin/users/${state.userId}/toggle-super-admin`);
        assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
        return { _log: `Super admin toggled: ${body.message}` };
    });

    await test('PUT /admin/users/:id → admin update user profile with ALL fields', async () => {
        const { status, body } = await request('PUT', `${API}/admin/users/${state.userId}`, {
            display_name: 'Jane Smith (Principal)',
            phone: '+1-555-999-8877',
            designation: 'Principal Consultant',
            color: '#6366F1',
            initials: 'JP',
        });
        assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
        return { _log: `User profile updated by admin: designation=Principal Consultant` };
    });

    await test('POST /admin/users/:id/remove-workspace → remove invited user from workspace', async () => {
        const { status, body } = await request('POST', `${API}/admin/users/${state.invitedUserId}/remove-workspace`, {
            workspace_id: state.workspaceId,
        });
        assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
        return { _log: `Invited user removed from workspace` };
    });

    // ─────────────────────────────────────────────────────────────
    // SECTION 12: Admin — Permissions
    // Route mount: /api/v1/admin/permissions → admin.permissions.routes.js
    // ─────────────────────────────────────────────────────────────
    console.log(`\n${BOLD}── 12. ADMIN — PERMISSIONS ───────────────────────────${RESET}`);

    await test('GET /admin/permissions → lists all 25 permission definitions', async () => {
        const { status, body } = await request('GET', `${API}/admin/permissions`);
        assert(status === 200, `Expected 200, got ${status}`);
        assert(Array.isArray(body.data), 'Expected array');
        assert(body.data.length >= 25, `Expected ≥25 permissions, got ${body.data.length}`);
        // Capture a permission ID for assign test
        state.permissionId = body.data.find(p => p.permission_key === 'reports.export')?.ROWID || body.data[0].ROWID;
        return { _log: `permissions: ${body.data.length} definitions loaded` };
    });

    await test('GET /admin/permissions/role/:roleId → get permissions for custom role', async () => {
        const { status, body } = await request('GET', `${API}/admin/permissions/role/${state.customRoleId}`);
        assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
        assert(Array.isArray(body.data), 'Expected array');
        return { _log: `custom role has ${body.data.length} permissions` };
    });

    await test('POST /admin/permissions/roles/:roleId/assign → assign permissions to custom role', async () => {
        const { status, body } = await request('POST', `${API}/admin/permissions/roles/${state.customRoleId}/assign`, {
            permission_ids: [state.permissionId],
        });
        assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
        return { _log: `Permission assigned: ${body.message}` };
    });

    await test('DELETE /admin/permissions/roles/:roleId/revoke/:permId → revoke permission', async () => {
        const { status, body } = await request('DELETE', `${API}/admin/permissions/roles/${state.customRoleId}/revoke/${state.permissionId}`);
        assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
        return { _log: `Permission revoked: ${body.message}` };
    });

    // ─────────────────────────────────────────────────────────────
    // SECTION 13: Admin — Audit Log
    // Route mount: /api/v1/admin/audit → admin.audit.routes.js
    // ─────────────────────────────────────────────────────────────
    console.log(`\n${BOLD}── 13. ADMIN — AUDIT LOG ─────────────────────────────${RESET}`);

    await test('GET /admin/audit → lists all audit entries', async () => {
        const { status, body } = await request('GET', `${API}/admin/audit`);
        assert(status === 200, `Expected 200, got ${status}`);
        assert(Array.isArray(body.data), 'Expected array');
        assert(body.data.length > 0, 'Expected at least 1 audit entry');
        return { _log: `audit entries: ${body.data.length}` };
    });

    await test('GET /admin/audit?workspace_id=:wsId → filtered audit log', async () => {
        const { status, body } = await request('GET', `${API}/admin/audit?workspace_id=${state.workspaceId}&limit=20`);
        assert(status === 200, `Expected 200, got ${status}`);
        assert(Array.isArray(body.data), 'Expected array');
        return { _log: `filtered audit: ${body.data.length} entries for workspace ${state.workspaceId}` };
    });

    await test('GET /admin/audit/workspace/:wsId → workspace-specific audit log', async () => {
        const { status, body } = await request('GET', `${API}/admin/audit/workspace/${state.workspaceId}`);
        assert(status === 200, `Expected 200, got ${status}`);
        assert(Array.isArray(body.data), 'Expected array');
        return { _log: `workspace audit: ${body.data.length} entries` };
    });

    // ─────────────────────────────────────────────────────────────
    // SECTION 14: Migration Tool
    // ─────────────────────────────────────────────────────────────
    console.log(`\n${BOLD}── 14. MIGRATION TOOL ────────────────────────────────${RESET}`);

    await test('GET /admin/migrate-datastore/guide → returns migration guide', async () => {
        const { status, body } = await request('GET', `${API}/admin/migrate-datastore/guide`, null, {
            'x-admin-secret': ADMIN_SECRET,
        });
        assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
        assert(body.success === true, 'Expected success=true');
        return { _log: `Migration guide returned successfully` };
    });

    await test('GET /admin/migrate-datastore/status → returns schema status', async () => {
        const { status, body } = await request('GET', `${API}/admin/migrate-datastore/status`, null, {
            'x-admin-secret': ADMIN_SECRET,
        });
        assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
        assert(body.data.tables, 'Expected tables in status');
        return { _log: `Schema status: ${body.summary?.ready_tables}/${body.summary?.total_tables} ready` };
    });

    await test('POST /admin/migrate-datastore/run → runs migration/validation check', async () => {
        const { status, body } = await request('POST', `${API}/admin/migrate-datastore/run`, null, {
            'x-admin-secret': ADMIN_SECRET,
        });
        assert([200, 207].includes(status), `Expected 200 or 207, got ${status}: ${JSON.stringify(body)}`);
        return { _log: `Migration ran: ${body.message || 'completed'}` };
    });

    await test('POST /admin/migrate-datastore/run (wrong secret) → 401 Unauthorized', async () => {
        const { status } = await request('POST', `${API}/admin/migrate-datastore/run`, null, {
            'x-admin-secret': 'wrong-secret',
        });
        assert(status === 401, `Expected 401, got ${status}`);
        return { _log: `Unauthorized correctly rejected` };
    });

    // ─────────────────────────────────────────────────────────────
    // SECTION 15: Error Handling
    // ─────────────────────────────────────────────────────────────
    console.log(`\n${BOLD}── 15. ERROR HANDLING ────────────────────────────────${RESET}`);

    await test('GET /services without X-Workspace-Id → 400 error', async () => {
        const { status, body } = await request('GET', `${API}/services`);
        assert(status === 400, `Expected 400, got ${status}: ${JSON.stringify(body)}`);
        return { _log: `Correct error: ${body.message}` };
    });

    await test('GET /workspaces/9999 (non-existent) → 404 error', async () => {
        const { status, body } = await request('GET', `${API}/workspaces/9999`);
        assert(status === 404, `Expected 404, got ${status}: ${JSON.stringify(body)}`);
        return { _log: `Correct 404: ${body.message}` };
    });

    await test('DELETE /services/NONEXISTENT → 404 error', async () => {
        const { status, body } = await request('DELETE', `${API}/services/nonexistent-id`, null, {
            'x-workspace-id': state.workspaceId,
        });
        assert(status === 404, `Expected 404, got ${status}: ${JSON.stringify(body)}`);
        return { _log: `Correct 404: ${body.message}` };
    });

    await test('PUT /organizations → update org brand_color and timezone', async () => {
        const { status, body } = await request('PUT', `${API}/organizations`, {
            brand_color: '#1D4ED8',
            timezone: 'Europe/London',
        });
        assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
        return { _log: `Org updated: brand_color=#1D4ED8` };
    });

    // ─────────────────────────────────────────────────────────────
    // SECTION 16: Cleanup — delete appointment, service, roles, users
    // ─────────────────────────────────────────────────────────────
    console.log(`\n${BOLD}── 16. CLEANUP (DELETE) ──────────────────────────────${RESET}`);

    await test('DELETE /appointments/:id → delete appointment', async () => {
        const { status, body } = await request('DELETE', `${API}/appointments/${state.appointmentId}`, null, {
            'x-workspace-id': state.workspaceId,
        });
        assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
        return { _log: `Appointment ${state.appointmentId} deleted` };
    });

    await test('DELETE /services/:id → delete service', async () => {
        const { status, body } = await request('DELETE', `${API}/services/${state.serviceId}`, null, {
            'x-workspace-id': state.workspaceId,
        });
        assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
        return { _log: `Service ${state.serviceId} deleted` };
    });

    await test('DELETE /admin/roles/roles/:roleId → delete custom Receptionist role', async () => {
        const { status, body } = await request('DELETE', `${API}/admin/roles/roles/${state.customRoleId}`);
        assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
        return { _log: `Custom role ${state.customRoleId} deleted` };
    });

    await test('DELETE /admin/workspaces/:id → delete second workspace', async () => {
        const { status, body } = await request('DELETE', `${API}/admin/workspaces/${state.secondWorkspaceId}`);
        assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
        return { _log: `Second workspace ${state.secondWorkspaceId} deleted` };
    });

    await test('DELETE /admin/users/:id → deactivate user (soft delete)', async () => {
        const { status, body } = await request('DELETE', `${API}/admin/users/${state.userId}`);
        assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
        return { _log: `User ${state.userId} deactivated via admin` };
    });

    await test('DELETE /users/:id → remove user from workspace (workspace-scoped)', async () => {
        // Note: user may already be removed from workspace by remove-workspace call above
        // This tests the workspace-scoped DELETE /users/:id endpoint
        const { status } = await request('DELETE', `${API}/users/${state.userId}`, null, {
            'x-workspace-id': state.workspaceId,
        });
        // 200 if still in workspace, 404 if already removed — both valid
        assert([200, 404].includes(status), `Expected 200 or 404, got ${status}`);
        return { _log: `User workspace membership cleanup: HTTP ${status}` };
    });

    // ─────────────────────────────────────────────────────────────
    // SECTION 13: Final DB Dump
    // ─────────────────────────────────────────────────────────────
    console.log(`\n${BOLD}── 13. FINAL DATABASE STATE ──────────────────────────${RESET}`);

    const { body: dbBody } = await request('GET', `${BASE}/server/debug/db`);

    const tablesToPrint = [
        'Organization', 'Workspaces', 'Users', 'UserWorkspaces',
        'Permissions', 'Roles', 'RolePermissions',
        'Services', 'Appointments', 'AuditLog',
    ];

    for (const tbl of tablesToPrint) {
        const rows = dbBody[tbl] || [];
        console.log(`\n   ${BOLD}${CYAN}📋 ${tbl}${RESET} — ${rows.length} row(s)`);
        printDBTable(tbl, rows);
    }

    // ─────────────────────────────────────────────────────────────
    // SUMMARY
    // ─────────────────────────────────────────────────────────────
    console.log(`\n${BOLD}${CYAN}╔══════════════════════════════════════════════════╗${RESET}`);
    console.log(`${BOLD}${CYAN}║                TEST RESULTS                      ║${RESET}`);
    console.log(`${BOLD}${CYAN}╠══════════════════════════════════════════════════╣${RESET}`);
    console.log(`${BOLD}${CYAN}║${RESET}  Total  : ${BOLD}${total}${RESET}${' '.repeat(41 - String(total).length)}${CYAN}║${RESET}`);
    console.log(`${BOLD}${CYAN}║${RESET}  ${GREEN}Passed${RESET} : ${BOLD}${GREEN}${passed}${RESET}${' '.repeat(41 - String(passed).length)}${CYAN}║${RESET}`);
    console.log(`${BOLD}${CYAN}║${RESET}  ${RED}Failed${RESET} : ${BOLD}${RED}${failed}${RESET}${' '.repeat(41 - String(failed).length)}${CYAN}║${RESET}`);
    console.log(`${BOLD}${CYAN}╚══════════════════════════════════════════════════╝${RESET}`);

    if (failed === 0) {
        console.log(`\n  ${GREEN}${BOLD}🎉  All ${total} tests passed! Application is working correctly.${RESET}\n`);
    } else {
        console.log(`\n  ${YELLOW}${BOLD}⚠  ${failed} test(s) failed. Review errors above.${RESET}\n`);
    }

    return failed === 0;
}

// ══════════════════════════════════════════════════════════════════
// ENTRYPOINT — Start server then run tests
// ══════════════════════════════════════════════════════════════════
async function main() {
    console.log(`\n${CYAN}Starting BookingsPlus dev server...${RESET}`);

    const serverProcess = spawn('node', ['dev-server.js'], {
        cwd: path.join(__dirname),
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
    });

    let serverReady = false;
    serverProcess.stdout.on('data', (data) => {
        const line = data.toString().trim();
        if (line.includes('running on')) {
            if (!serverReady) {
                serverReady = true;
                console.log(`${GREEN}  ✓ Dev server started${RESET}`);
            }
        }
    });
    serverProcess.stderr.on('data', (data) => {
        const line = data.toString().trim();
        if (line && !line.includes('DeprecationWarning') && !line.includes('ExperimentalWarning')) {
            // Only show real errors, not Node.js warnings
            if (line.toLowerCase().includes('error') && !line.toLowerCase().includes('audit')) {
                process.stderr.write(`  ${RED}[server stderr]${RESET} ${line}\n`);
            }
        }
    });

    try {
        console.log(`${CYAN}Waiting for server on port 5000...${RESET}`);
        await waitForServer(40, 400);
        console.log(`${GREEN}  ✓ Server is ready${RESET}\n`);

        const success = await runTests();

        serverProcess.kill();
        process.exit(success ? 0 : 1);
    } catch (err) {
        console.error(`\n${RED}Fatal error: ${err.message}${RESET}`);
        serverProcess.kill();
        process.exit(1);
    }
}

main();
