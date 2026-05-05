/**
 * Public Booking Function — Open Access (No Authentication Required)
 * 
 * This is a SEPARATE Catalyst Advanced I/O function with open_access=true.
 * It handles public booking links that can be accessed by ANYONE on the internet
 * without a Catalyst account or login.
 * 
 * It serves:
 *   1. GET  /page/:serviceId  → The standalone booking HTML page
 *   2. GET  /api/service/:id  → Fetch service details (public)
 *   3. POST /api/book         → Submit a booking (public)
 * 
 * Data Store access uses catalyst.initialize(req) which works because
 * Catalyst still injects project headers for open_access functions —
 * they just don't require user authentication.
 */
const express = require('express');
const cors = require('cors');
const catalyst = require('zcatalyst-sdk-node');

const app = express();

app.use(cors());
app.use(express.json());

// ── Catalyst SDK Initialization ──
// For open_access functions, Catalyst still injects project headers
// but does NOT inject user credentials. We use admin scope.
app.use((req, res, next) => {
    try {
        req.catalystApp = catalyst.initialize(req, { scope: 'admin' });
    } catch (err) {
        console.error('Catalyst SDK init failed:', err.message);
        // Try initializeApp from environment
        try {
            req.catalystApp = catalyst.initializeApp();
        } catch (err2) {
            console.error('Catalyst initializeApp also failed:', err2.message);
            return res.status(500).json({ 
                success: false, 
                message: 'Service temporarily unavailable. Please try again later.' 
            });
        }
    }
    next();
});

// ── Helper: Format datetime for Catalyst Data Store ──
const catalystDateTime = (date) => {
    const d = date || new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

// Fixed: Extract date/time parts from ISO string directly to avoid UTC conversion.
// new Date(iso).getHours() returns UTC hours on server, causing timezone offset
// (e.g. 9:00 AM IST sent as ISO → server reads UTC 03:30 → stores 03:30).
const formatDT = (val) => {
    if (!val) return catalystDateTime();
    // Already in "yyyy-MM-dd HH:mm:ss" format — pass through
    if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/.test(String(val))) return String(val);
    // ISO string "2025-05-01T09:00:00.000Z" — extract date/time directly
    const isoMatch = String(val).match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/);
    if (isoMatch) return `${isoMatch[1]} ${isoMatch[2]}`;
    // Fallback: parse as Date (may still have UTC issue for non-ISO formats)
    const d = new Date(val);
    if (!isNaN(d.getTime())) return catalystDateTime(d);
    return catalystDateTime();
};

const toBigInt = (val) => {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number' && !isNaN(val)) return val;
    const p = parseInt(String(val), 10);
    return (!isNaN(p) && p >= 0) ? p : 0;
};

// ═══════════════════════════════════════════════════════════════
// API: GET /api/service/:id — Fetch service details
// ═══════════════════════════════════════════════════════════════
app.get('/api/service/:id', async (req, res) => {
    try {
        const serviceId = req.params.id;
        const zcql = req.catalystApp.zcql();
        
        // Try by service_id first, then by ROWID
        let result = await zcql.executeZCQLQuery(
            `SELECT * FROM Services WHERE service_id = '${serviceId}' LIMIT 1`
        );
        
        if (!result || result.length === 0) {
            result = await zcql.executeZCQLQuery(
                `SELECT * FROM Services WHERE ROWID = '${serviceId}' LIMIT 1`
            );
        }
        
        if (!result || result.length === 0) {
            return res.status(404).json({ success: false, message: 'Service not found' });
        }
        
        const svc = result[0].Services || result[0];
        
        return res.json({
            success: true,
            data: {
                id: svc.service_id || svc.ROWID,
                service_id: svc.service_id || svc.ROWID,
                name: svc.service_name || '',
                service_name: svc.service_name || '',
                description: svc.description || '',
                duration_minutes: parseInt(svc.duration_minutes, 10) || 60,
                price: svc.price || '0',
                service_type: svc.service_type || 'one-on-one',
                meeting_mode: svc.meeting_mode || 'Online',
                seats: parseInt(svc.seats, 10) || 1,
                status: svc.status || 'active',
            }
        });
    } catch (err) {
        console.error('Error fetching service:', err);
        return res.status(500).json({ success: false, message: 'Failed to load service details' });
    }
});

// ═══════════════════════════════════════════════════════════════
// API: POST /api/book — Submit a public booking
// ═══════════════════════════════════════════════════════════════
app.post('/api/book', async (req, res) => {
    try {
        const { service_id, customer_name, customer_email, customer_phone, start_time, end_time, notes } = req.body;
        
        if (!service_id) return res.status(400).json({ success: false, message: 'Service ID is required' });
        if (!customer_name) return res.status(400).json({ success: false, message: 'Name is required' });
        if (!customer_email) return res.status(400).json({ success: false, message: 'Email is required' });
        if (!start_time || !end_time) return res.status(400).json({ success: false, message: 'Start and end time are required' });
        
        const zcql = req.catalystApp.zcql();
        const datastore = req.catalystApp.datastore();
        
        // 1. Fetch the service to get workspace_id and organization_id
        let serviceResult = await zcql.executeZCQLQuery(
            `SELECT * FROM Services WHERE service_id = '${service_id}' LIMIT 1`
        );
        if (!serviceResult || serviceResult.length === 0) {
            serviceResult = await zcql.executeZCQLQuery(
                `SELECT * FROM Services WHERE ROWID = '${service_id}' LIMIT 1`
            );
        }
        if (!serviceResult || serviceResult.length === 0) {
            return res.status(404).json({ success: false, message: 'Service not found' });
        }
        
        const service = serviceResult[0].Services || serviceResult[0];
        const workspaceId = service.workspace_id;
        const organizationId = service.organization_id;
        const serviceName = service.service_name || '';
        const serviceType = service.service_type || 'one-on-one';
        
        console.log(`[PublicBooking] Booking for service "${serviceName}" (ws=${workspaceId}, org=${organizationId})`);
        
        // 2. Create or find customer
        let customerId = 0;
        try {
            let customerResult = [];
            try {
                customerResult = await zcql.executeZCQLQuery(
                    `SELECT * FROM Customers WHERE customer_email = '${customer_email}' AND workspace_id = '${workspaceId}' LIMIT 1`
                );
            } catch (e1) {
                try {
                    customerResult = await zcql.executeZCQLQuery(
                        `SELECT * FROM Customers WHERE email = '${customer_email}' AND workspace_id = '${workspaceId}' LIMIT 1`
                    );
                } catch (e2) {
                    console.warn('Customer lookup failed:', e2.message);
                }
            }
            
            if (customerResult && customerResult.length > 0) {
                const existing = customerResult[0].Customers || customerResult[0];
                customerId = toBigInt(existing.customer_id || existing.ROWID);
            } else {
                // Create new customer
                try {
                    const newCustomer = await datastore.table('Customers').insertRow({
                        customer_id: Date.now(),
                        organization_id: toBigInt(organizationId),
                        workspace_id: toBigInt(workspaceId),
                        customer_name: customer_name,
                        customer_email: customer_email,
                        customer_phone: customer_phone || '',
                        status: 'active',
                    });
                    customerId = toBigInt(newCustomer.customer_id || newCustomer.ROWID);
                } catch (insertErr) {
                    console.warn('Customer insert failed, trying alt columns:', insertErr.message);
                    try {
                        const newCustomer = await datastore.table('Customers').insertRow({
                            customer_id: Date.now(),
                            organization_id: toBigInt(organizationId),
                            workspace_id: toBigInt(workspaceId),
                            name: customer_name,
                            email: customer_email,
                            phone: customer_phone || '',
                            status: 'active',
                        });
                        customerId = toBigInt(newCustomer.customer_id || newCustomer.ROWID);
                    } catch (retryErr) {
                        console.error('Customer insert retry failed:', retryErr.message);
                    }
                }
            }
        } catch (err) {
            console.error('Error handling customer:', err.message);
        }
        
        // 3. Auto-assign staff (for non-resource services)
        let staffId = 0;
        let staffName = '';
        
        if (serviceType !== 'resource') {
            try {
                // Get assigned staff for this service
                const staffResult = await zcql.executeZCQLQuery(
                    `SELECT ss.staff_id, u.display_name FROM ServiceStaff ss ` +
                    `LEFT JOIN Users u ON ss.staff_id = u.ROWID ` +
                    `WHERE ss.service_id = '${service_id}' AND ss.workspace_id = '${workspaceId}'`
                );
                
                if (staffResult && staffResult.length > 0) {
                    // Simple availability: find staff without conflicting appointments
                    let busyStaffIds = new Set();
                    
                    try {
                        const conflictResult = await zcql.executeZCQLQuery(
                            `SELECT staff_id FROM Appointments ` +
                            `WHERE workspace_id = '${workspaceId}' ` +
                            `AND appointment_status != 'Cancelled' ` +
                            `AND start_time < '${formatDT(end_time)}' ` +
                            `AND end_time > '${formatDT(start_time)}'`
                        );
                        if (conflictResult) {
                            conflictResult.forEach(r => {
                                const apt = r.Appointments || r;
                                if (apt.staff_id) busyStaffIds.add(String(apt.staff_id));
                            });
                        }
                    } catch (e) {
                        console.warn('Conflict check failed:', e.message);
                    }
                    
                    const availableStaff = staffResult.filter(r => {
                        const ss = r.ServiceStaff || r;
                        return !busyStaffIds.has(String(ss.staff_id));
                    });
                    
                    if (availableStaff.length > 0) {
                        const chosen = availableStaff[0];
                        const ss = chosen.ServiceStaff || chosen;
                        const u = chosen.Users || {};
                        staffId = toBigInt(ss.staff_id);
                        staffName = u.display_name || '';
                    } else if (staffResult.length > 0) {
                        // All staff busy, use first assigned anyway
                        const chosen = staffResult[0];
                        const ss = chosen.ServiceStaff || chosen;
                        const u = chosen.Users || {};
                        staffId = toBigInt(ss.staff_id);
                        staffName = u.display_name || '';
                    }
                }
            } catch (err) {
                console.warn('Staff assignment resolution failed:', err.message);
            }
        }
        
        // 4. Create the appointment
        const appointmentId = Date.now();
        
        const appointmentData = {
            appointment_id: appointmentId,
            organization_id: toBigInt(organizationId),
            workspace_id: toBigInt(workspaceId),
            service_id: toBigInt(service_id),
            service_name: serviceName,
            staff_id: staffId,
            staff_name: staffName,
            customer_id: customerId,
            customer_name: customer_name || '',
            appointment_status: 'Pending',
            start_time: formatDT(start_time),
            end_time: formatDT(end_time),
            notes: notes || `Booked by ${customer_name} (${customer_email})${customer_phone ? `, Phone: ${customer_phone}` : ''}`,
            payment_status: 'Unpaid',
            approval_status: 'Awaiting',
        };
        
        let row;
        try {
            row = await datastore.table('Appointments').insertRow(appointmentData);
        } catch (insertErr) {
            console.warn('Full insert failed, trying minimal:', insertErr.message);
            // Retry with minimal columns
            row = await datastore.table('Appointments').insertRow({
                appointment_id: appointmentId,
                organization_id: toBigInt(organizationId),
                workspace_id: toBigInt(workspaceId),
                service_id: toBigInt(service_id),
                staff_id: staffId,
                customer_name: customer_name || '',
                appointment_status: 'Pending',
                start_time: formatDT(start_time),
                end_time: formatDT(end_time),
            });
        }
        
        console.log(`[PublicBooking] Appointment created: ID=${appointmentId}, ROWID=${row.ROWID}`);
        
        return res.status(201).json({
            success: true,
            message: 'Booking confirmed!',
            data: {
                appointment_id: appointmentId,
                ROWID: row.ROWID,
                service_name: serviceName,
                staff_name: staffName,
                customer_name: customer_name,
                start_time: start_time,
                end_time: end_time,
            }
        });
        
    } catch (err) {
        console.error('Booking error:', err);
        return res.status(500).json({ 
            success: false, 
            message: 'Failed to create booking: ' + (err.message || 'Unknown error') 
        });
    }
});

// ═══════════════════════════════════════════════════════════════
// PAGE: GET /page/:serviceId — Serve the standalone booking HTML
// ═══════════════════════════════════════════════════════════════
app.get('/page/:serviceId', (req, res) => {
    const serviceId = req.params.serviceId;
    res.setHeader('Content-Type', 'text/html');
    res.send(getBookingPageHTML(serviceId));
});

// ═══════════════════════════════════════════════════════════════
// Root — Health check
// ═══════════════════════════════════════════════════════════════
app.get('/', (req, res) => {
    res.json({ success: true, message: 'BookingsPlus Public Booking API', version: '1.0.0' });
});

// ═══════════════════════════════════════════════════════════════
// Standalone Booking Page HTML
// ═══════════════════════════════════════════════════════════════
function getBookingPageHTML(serviceId) {
    // The API base URL is relative to this function's own endpoint
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Book an Appointment — BookingsPlus</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: #F8FAFC; color: #111827; -webkit-font-smoothing: antialiased; }
        
        .booking-container { min-height: 100vh; display: flex; justify-content: center; padding: 40px 20px; }
        .booking-card { width: 100%; max-width: 850px; background: white; border-radius: 16px; display: flex; border: 1px solid #E2E8F0; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); overflow: hidden; transition: max-width 0.3s ease; }
        .booking-card.expanded { max-width: 1000px; }
        
        /* Left Panel */
        .left-panel { width: 320px; background: #FAFAFA; border-right: 1px solid #E2E8F0; padding: 32px; flex-shrink: 0; }
        .brand { display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; border: 1px solid #E5E7EB; border-radius: 8px; background: white; font-size: 12px; font-weight: 600; color: #4B5563; margin-bottom: 16px; }
        .brand-icon { width: 20px; height: 20px; background: #4F46E5; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: white; font-size: 11px; font-weight: 700; }
        .service-title { font-size: 24px; font-weight: 700; margin-bottom: 16px; line-height: 1.2; }
        .info-row { display: flex; align-items: center; gap: 12px; color: #4B5563; font-size: 14.5px; font-weight: 500; margin-bottom: 16px; }
        .info-row svg { color: #6B7280; flex-shrink: 0; }
        .info-row.confirmed { color: #16A34A; font-weight: 600; }
        .info-row.confirmed svg { color: #16A34A; }
        .service-desc { font-size: 14px; color: #6B7280; line-height: 1.6; }
        .back-btn { background: none; border: none; display: flex; align-items: center; gap: 8px; color: #111827; font-weight: 600; font-size: 14px; cursor: pointer; margin-bottom: 32px; padding: 0; }
        
        /* Right Panel */
        .right-panel { flex: 1; padding: 32px; display: flex; gap: 32px; }
        .right-panel.form-view { flex-direction: column; }
        
        .calendar-section { flex: 2; }
        .section-title { font-size: 20px; font-weight: 700; margin-bottom: 24px; }
        
        .month-nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .month-name { font-size: 15px; font-weight: 600; }
        .nav-btns { display: flex; gap: 8px; }
        .nav-btn { background: #F3F4F6; border: none; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.2s; }
        .nav-btn:hover { background: #E5E7EB; }
        .nav-btn.next { transform: rotate(180deg); }
        
        .day-headers { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; margin-bottom: 12px; }
        .day-header { text-align: center; font-size: 11px; font-weight: 600; color: #6B7280; }
        
        .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; }
        .cal-day { aspect-ratio: 1; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 500; border-radius: 50%; cursor: pointer; border: 1px solid transparent; transition: all 0.2s; }
        .cal-day:hover:not(.disabled):not(.selected) { background: #F3F4F6; }
        .cal-day.disabled { color: #D1D5DB; cursor: default; }
        .cal-day.today { color: #4F46E5; font-weight: 600; background: #EEF2FF; }
        .cal-day.selected { background: #4F46E5 !important; color: white !important; font-weight: 600; border-color: #4F46E5; }
        
        /* Time Slots */
        .slots-section { flex: 1.2; display: flex; flex-direction: column; height: 400px; }
        .slots-date { font-size: 16px; font-weight: 600; margin-bottom: 24px; }
        .slots-list { overflow-y: auto; padding-right: 8px; display: flex; flex-direction: column; gap: 10px; }
        .slot-row { display: flex; gap: 8px; }
        .slot-btn { flex: 1; padding: 14px; border-radius: 8px; font-size: 15px; font-weight: 600; border: 1px solid #CBD5E1; background: white; color: #4F46E5; cursor: pointer; transition: all 0.15s; }
        .slot-btn:hover { border-color: #4F46E5; border-width: 2px; padding: 13px; }
        .slot-btn.selected { background: #111827; color: white; border: 2px solid #111827; padding: 13px; }
        .next-btn { padding: 0 24px; background: #4F46E5; color: white; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; animation: fadeIn 0.2s ease; }
        
        /* Form */
        .form-section { max-width: 400px; }
        .form-group { margin-bottom: 20px; }
        .form-label { display: block; font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 8px; }
        .form-input { width: 100%; padding: 12px 14px; border-radius: 8px; border: 1px solid #D1D5DB; font-size: 15px; outline: none; transition: border-color 0.2s; font-family: inherit; }
        .form-input:focus { border-color: #4F46E5; }
        .phone-group { display: flex; }
        .phone-prefix { padding: 12px 16px; background: #F3F4F6; border: 1px solid #D1D5DB; border-right: none; border-radius: 8px 0 0 8px; font-size: 15px; color: #4B5563; }
        .phone-input { border-radius: 0 8px 8px 0 !important; }
        .submit-btn { width: fit-content; margin-top: 16px; padding: 12px 24px; background: #4F46E5; color: white; border: none; border-radius: 24px; font-size: 15px; font-weight: 600; cursor: pointer; font-family: inherit; }
        .submit-btn:disabled { opacity: 0.7; cursor: not-allowed; }
        
        /* Confirmation */
        .confirm-container { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .confirm-card { width: 100%; max-width: 450px; background: white; border-radius: 16px; padding: 40px 32px; border: 1px solid #E2E8F0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); text-align: center; }
        .confirm-icon { width: 64px; height: 64px; background: #DCFCE7; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; }
        .confirm-title { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
        .confirm-text { color: #6B7280; font-size: 15px; margin-bottom: 24px; line-height: 1.5; }
        .confirm-details { background: #F8FAFC; border-radius: 12px; padding: 20px; text-align: left; margin-bottom: 32px; }
        .confirm-row { display: flex; align-items: center; gap: 12px; font-size: 14px; color: #475569; margin-bottom: 12px; }
        .confirm-row:last-child { margin-bottom: 0; }
        .confirm-row strong { color: #1E293B; }
        .booking-id { font-family: monospace; background: #F1F5F9; padding: 2px 6px; border-radius: 4px; }
        
        /* Loading */
        .loading { display: flex; align-items: center; justify-content: center; min-height: 100vh; }
        .spinner { width: 40px; height: 40px; border: 3px solid #E5E7EB; border-top-color: #4F46E5; border-radius: 50%; animation: spin 0.8s linear infinite; }
        
        /* Error */
        .error-container { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .error-card { text-align: center; max-width: 400px; }
        .error-icon { width: 64px; height: 64px; background: #FEF2F2; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; }
        .error-title { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
        .error-text { color: #6B7280; font-size: 14px; line-height: 1.6; }
        
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateX(8px); } to { opacity: 1; transform: translateX(0); } }
        
        @media (max-width: 768px) {
            .booking-card, .booking-card.expanded { flex-direction: column; max-width: 100%; }
            .left-panel { width: 100%; border-right: none; border-bottom: 1px solid #E2E8F0; }
            .right-panel { flex-direction: column !important; }
            .slots-section { height: auto; }
        }
    </style>
</head>
<body>
    <div id="app"></div>
    
    <script>
    (function() {
        'use strict';
        
        // ── Configuration ──
        const SERVICE_ID = '${serviceId}';
        // API calls go to the same function origin
        const API_BASE = window.location.pathname.replace(/\\/page\\/.*$/, '');
        
        const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        const SHORT_DAYS = ['M','T','W','T','F','S','S'];
        
        // ── State ──
        let state = {
            service: null,
            loading: true,
            error: null,
            currentMonth: new Date().getMonth(),
            currentYear: new Date().getFullYear(),
            selectedDate: null,
            selectedSlot: null,
            step: 1,
            formData: { name: '', email: '', phone: '' },
            submitting: false,
            booked: false,
            bookingResult: null,
        };
        
        // ── API ──
        async function fetchService() {
            try {
                const resp = await fetch(API_BASE + '/api/service/' + SERVICE_ID);
                const data = await resp.json();
                if (data.success && data.data) {
                    state.service = data.data;
                    state.loading = false;
                } else {
                    state.error = 'Service not found';
                    state.loading = false;
                }
            } catch (err) {
                console.error('Failed to fetch service:', err);
                state.error = 'Failed to load service. Please try again later.';
                state.loading = false;
            }
            render();
        }
        
        async function submitBooking() {
            state.submitting = true;
            render();
            
            const startTime = new Date(state.selectedDate);
            startTime.setHours(state.selectedSlot.hour, state.selectedSlot.min, 0, 0);
            
            const endTime = new Date(startTime);
            endTime.setMinutes(endTime.getMinutes() + (state.service.duration_minutes || 60));
            
            // Format as "yyyy-MM-dd HH:mm:ss" in LOCAL time (not ISO/UTC).
            // Catalyst Data Store interprets datetime values as IST and converts to UTC internally.
            // Sending ISO strings causes double-conversion (browser UTC → server extracts UTC → Catalyst treats as IST → converts to UTC again).
            function padN(n) { return String(n).padStart(2, '0'); }
            function fmtLocal(d) {
                return d.getFullYear() + '-' + padN(d.getMonth()+1) + '-' + padN(d.getDate()) + ' ' + padN(d.getHours()) + ':' + padN(d.getMinutes()) + ':' + padN(d.getSeconds());
            }
            
            try {
                const resp = await fetch(API_BASE + '/api/book', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        service_id: state.service.service_id || state.service.id,
                        customer_name: state.formData.name,
                        customer_email: state.formData.email,
                        customer_phone: state.formData.phone,
                        start_time: fmtLocal(startTime),
                        end_time: fmtLocal(endTime),
                    })
                });
                const data = await resp.json();
                if (data.success) {
                    state.booked = true;
                    state.bookingResult = data.data;
                } else {
                    alert('Booking failed: ' + (data.message || 'Unknown error'));
                }
            } catch (err) {
                console.error('Booking error:', err);
                alert('Booking failed. Please try again.');
            }
            state.submitting = false;
            render();
        }
        
        // ── Helpers ──
        function formatDuration(mins) {
            if (!mins) return '1 hr';
            const h = Math.floor(mins / 60), m = mins % 60;
            if (h && m) return h + ' hr ' + m + ' min';
            if (h) return h + ' hr';
            return m + ' min';
        }
        
        function generateTimeSlots() {
            const slots = [];
            for (let hour = 9; hour < 17; hour++) {
                for (let min = 0; min < 60; min += 15) {
                    const h = hour > 12 ? hour - 12 : hour;
                    const ampm = hour >= 12 ? 'pm' : 'am';
                    const mm = String(min).padStart(2, '0');
                    slots.push({ label: String(h).padStart(2, '0') + ':' + mm + ' ' + ampm, hour: hour, min: min });
                }
            }
            return slots;
        }
        
        function isToday(day) {
            const t = new Date();
            return day === t.getDate() && state.currentMonth === t.getMonth() && state.currentYear === t.getFullYear();
        }
        function isPast(day) {
            const d = new Date(state.currentYear, state.currentMonth, day);
            const t = new Date(); t.setHours(0,0,0,0);
            return d < t;
        }
        function isWeekend(day) {
            const dow = new Date(state.currentYear, state.currentMonth, day).getDay();
            return dow === 0 || dow === 6;
        }
        
        function svgIcon(name) {
            const icons = {
                clock: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
                calendar: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
                globe: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
                arrowLeft: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',
                check: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
                users: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
                alertCircle: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
            };
            return icons[name] || '';
        }
        
        // ── Render ──
        function render() {
            const app = document.getElementById('app');
            
            if (state.loading) {
                app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
                return;
            }
            
            if (state.error) {
                app.innerHTML = '<div class="error-container"><div class="error-card">' +
                    '<div class="error-icon">' + svgIcon('alertCircle') + '</div>' +
                    '<h2 class="error-title">Unable to Load</h2>' +
                    '<p class="error-text">' + state.error + '</p></div></div>';
                return;
            }
            
            if (state.booked) {
                renderConfirmation(app);
                return;
            }
            
            renderBookingForm(app);
        }
        
        function renderConfirmation(app) {
            const sd = state.selectedDate;
            const sl = state.selectedSlot;
            const svc = state.service;
            const res = state.bookingResult || {};
            
            app.innerHTML = '<div class="confirm-container"><div class="confirm-card">' +
                '<div class="confirm-icon">' + svgIcon('check') + '</div>' +
                '<h2 class="confirm-title">Booking Confirmed!</h2>' +
                '<p class="confirm-text">You are scheduled with <strong>' + svc.name + '</strong>.<br/>' +
                'Booking ID: <span class="booking-id">' + (res.appointment_id || res.ROWID || '') + '</span></p>' +
                '<div class="confirm-details">' +
                    '<div class="confirm-row">' + svgIcon('calendar') + ' <strong>' + DAYS[sd.getDay()] + ', ' + MONTHS[sd.getMonth()] + ' ' + sd.getDate() + ', ' + sd.getFullYear() + '</strong></div>' +
                    '<div class="confirm-row">' + svgIcon('clock') + ' <strong>' + sl.label + '</strong> (' + (svc.duration_minutes || 60) + ' min)</div>' +
                    '<div class="confirm-row">' + svgIcon('globe') + ' <strong>India Standard Time</strong></div>' +
                '</div></div></div>';
        }
        
        function renderBookingForm(app) {
            const svc = state.service;
            const isExpanded = state.step === 1 && state.selectedDate;
            
            let html = '<div class="booking-container"><div class="booking-card' + (isExpanded ? ' expanded' : '') + '">';
            
            // Left Panel
            html += '<div class="left-panel">';
            if (state.step === 2) {
                html += '<button class="back-btn" onclick="goBack()">' + svgIcon('arrowLeft') + ' Back</button>';
            }
            html += '<div class="brand"><div class="brand-icon">B</div> BOOKINGS+</div>';
            html += '<h1 class="service-title">' + (svc.name || svc.service_name || 'Service') + '</h1>';
            html += '<div class="info-row">' + svgIcon('clock') + ' ' + formatDuration(svc.duration_minutes || 60) + '</div>';
            if (svc.service_type === 'group') {
                html += '<div class="info-row">' + svgIcon('users') + ' Group Booking</div>';
            }
            if (state.step === 2 && state.selectedDate && state.selectedSlot) {
                html += '<div class="info-row confirmed">' + svgIcon('calendar') + ' <div>' + state.selectedSlot.label + ' — ' + DAYS[state.selectedDate.getDay()] + ', ' + MONTHS[state.selectedDate.getMonth()] + ' ' + state.selectedDate.getDate() + ', ' + state.selectedDate.getFullYear() + '</div></div>';
            }
            html += '<div class="info-row">' + svgIcon('globe') + ' India Standard Time</div>';
            html += '<div class="service-desc">' + (svc.description || 'Welcome to my scheduling page. Please follow the instructions to add an event to my calendar.') + '</div>';
            html += '</div>';
            
            // Right Panel
            if (state.step === 1) {
                html += '<div class="right-panel">';
                html += renderCalendar();
                if (state.selectedDate) html += renderTimeSlots();
                html += '</div>';
            } else {
                html += '<div class="right-panel form-view">';
                html += renderDetailsForm();
                html += '</div>';
            }
            
            html += '</div></div>';
            app.innerHTML = html;
        }
        
        function renderCalendar() {
            const today = new Date();
            const firstDay = new Date(state.currentYear, state.currentMonth, 1).getDay();
            const daysInMonth = new Date(state.currentYear, state.currentMonth + 1, 0).getDate();
            const adj = firstDay === 0 ? 6 : firstDay - 1;
            
            let html = '<div class="calendar-section">';
            html += '<h2 class="section-title">Select a Date & Time</h2>';
            
            html += '<div class="month-nav">';
            html += '<span class="month-name">' + MONTHS[state.currentMonth] + ' ' + state.currentYear + '</span>';
            html += '<div class="nav-btns">';
            html += '<button class="nav-btn" onclick="prevMonth()">' + svgIcon('arrowLeft') + '</button>';
            html += '<button class="nav-btn next" onclick="nextMonth()">' + svgIcon('arrowLeft') + '</button>';
            html += '</div></div>';
            
            html += '<div class="day-headers">';
            SHORT_DAYS.forEach(function(d) { html += '<div class="day-header">' + d + '</div>'; });
            html += '</div>';
            
            html += '<div class="calendar-grid">';
            for (let i = 0; i < adj; i++) html += '<div class="cal-day disabled"></div>';
            for (let d = 1; d <= daysInMonth; d++) {
                const disabled = isPast(d) || isWeekend(d);
                const today_f = isToday(d);
                const selected = state.selectedDate && d === state.selectedDate.getDate() && state.currentMonth === state.selectedDate.getMonth() && state.currentYear === state.selectedDate.getFullYear();
                let cls = 'cal-day';
                if (disabled) cls += ' disabled';
                if (today_f && !selected) cls += ' today';
                if (selected) cls += ' selected';
                html += '<div class="' + cls + '"' + (disabled ? '' : ' onclick="selectDate(' + d + ')"') + '>' + d + '</div>';
            }
            html += '</div></div>';
            return html;
        }
        
        function renderTimeSlots() {
            const slots = generateTimeSlots();
            const sd = state.selectedDate;
            
            let html = '<div class="slots-section">';
            html += '<div class="slots-date">' + DAYS[sd.getDay()] + ', ' + MONTHS[sd.getMonth()] + ' ' + sd.getDate() + '</div>';
            html += '<div class="slots-list">';
            
            slots.forEach(function(slot, i) {
                const selected = state.selectedSlot && state.selectedSlot.hour === slot.hour && state.selectedSlot.min === slot.min;
                html += '<div class="slot-row">';
                html += '<button class="slot-btn' + (selected ? ' selected' : '') + '" onclick="selectSlot(' + slot.hour + ',' + slot.min + ',\\'' + slot.label + '\\')">' + slot.label + '</button>';
                if (selected) {
                    html += '<button class="next-btn" onclick="goToDetails()">Next</button>';
                }
                html += '</div>';
            });
            
            html += '</div></div>';
            return html;
        }
        
        function renderDetailsForm() {
            let html = '<div class="form-section">';
            html += '<h2 class="section-title">Enter Details</h2>';
            html += '<form onsubmit="handleSubmit(event)">';
            
            html += '<div class="form-group"><label class="form-label">Name *</label>';
            html += '<input type="text" class="form-input" required value="' + state.formData.name + '" oninput="updateForm(\\'name\\', this.value)" /></div>';
            
            html += '<div class="form-group"><label class="form-label">Email *</label>';
            html += '<input type="email" class="form-input" required value="' + state.formData.email + '" oninput="updateForm(\\'email\\', this.value)" /></div>';
            
            html += '<div class="form-group"><label class="form-label">Phone Number *</label>';
            html += '<div class="phone-group"><div class="phone-prefix">+91</div>';
            html += '<input type="tel" class="form-input phone-input" required value="' + state.formData.phone + '" oninput="updateForm(\\'phone\\', this.value)" /></div></div>';
            
            html += '<button type="submit" class="submit-btn"' + (state.submitting ? ' disabled' : '') + '>' + (state.submitting ? 'Scheduling...' : 'Schedule Event') + '</button>';
            html += '</form></div>';
            return html;
        }
        
        // ── Global Handlers ──
        window.prevMonth = function() {
            if (state.currentMonth === 0) { state.currentMonth = 11; state.currentYear--; }
            else state.currentMonth--;
            render();
        };
        window.nextMonth = function() {
            if (state.currentMonth === 11) { state.currentMonth = 0; state.currentYear++; }
            else state.currentMonth++;
            render();
        };
        window.selectDate = function(day) {
            state.selectedDate = new Date(state.currentYear, state.currentMonth, day);
            state.selectedSlot = null;
            render();
        };
        window.selectSlot = function(hour, min, label) {
            state.selectedSlot = { hour: hour, min: min, label: label };
            render();
        };
        window.goToDetails = function() {
            state.step = 2;
            render();
        };
        window.goBack = function() {
            state.step = 1;
            render();
        };
        window.updateForm = function(field, value) {
            state.formData[field] = value;
        };
        window.handleSubmit = function(e) {
            e.preventDefault();
            if (!state.formData.name || !state.formData.email || !state.formData.phone) return;
            submitBooking();
        };
        
        // ── Init ──
        fetchService();
    })();
    </script>
</body>
</html>`;
}

module.exports = app;
