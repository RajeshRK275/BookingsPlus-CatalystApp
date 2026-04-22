import React, { useState } from 'react';
import { ArrowLeft, Search, Building2, LayoutGrid, Puzzle, Palette, ShieldCheck, Users, MapPin, CalendarDays, Video, TrendingUp, CreditCard, Link2, Bell, Download, ChevronRight } from 'lucide-react';
import './Settings.css';

/* ─── Settings Sub-page Components ─── */

// ===================== ORGANIZATION =====================

const BasicInformation = ({ onBack }) => {
    const [form, setForm] = useState({
        companyName: 'JINS',
        industry: 'Professional Services',
        timezone: 'Asia/Kolkata (GMT +05:30)',
        dateFormat: 'DD/MM/YYYY',
        timeFormat: '12 Hours',
        currency: 'USD - US Dollar',
        language: 'English',
        phone: '+1 (555) 123-4567',
        website: 'https://bookingsplus.example.com',
        address: '123 Business Ave, Suite 100',
    });

    return (
        <SettingsSubPage title="Basic Information" subtitle="Manage your organization's basic details" onBack={onBack}>
            <div className="settings-form-grid">
                <FormField label="Company Name" value={form.companyName} onChange={v => setForm({...form, companyName: v})} />
                <FormField label="Industry" value={form.industry} onChange={v => setForm({...form, industry: v})} type="select" options={['Professional Services', 'Healthcare', 'Education', 'Technology', 'Finance', 'Other']} />
                <FormField label="Timezone" value={form.timezone} onChange={v => setForm({...form, timezone: v})} type="select" options={['Asia/Kolkata (GMT +05:30)', 'America/New_York (GMT -05:00)', 'America/Los_Angeles (GMT -08:00)', 'Europe/London (GMT +00:00)', 'Asia/Tokyo (GMT +09:00)']} />
                <FormField label="Date Format" value={form.dateFormat} onChange={v => setForm({...form, dateFormat: v})} type="select" options={['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']} />
                <FormField label="Time Format" value={form.timeFormat} onChange={v => setForm({...form, timeFormat: v})} type="select" options={['12 Hours', '24 Hours']} />
                <FormField label="Currency" value={form.currency} onChange={v => setForm({...form, currency: v})} type="select" options={['USD - US Dollar', 'EUR - Euro', 'GBP - British Pound', 'INR - Indian Rupee', 'AUD - Australian Dollar']} />
                <FormField label="Language" value={form.language} onChange={v => setForm({...form, language: v})} type="select" options={['English', 'Spanish', 'French', 'German', 'Portuguese']} />
                <FormField label="Phone" value={form.phone} onChange={v => setForm({...form, phone: v})} />
                <FormField label="Website" value={form.website} onChange={v => setForm({...form, website: v})} />
                <FormField label="Address" value={form.address} onChange={v => setForm({...form, address: v})} fullWidth />
            </div>
            <SaveBar />
        </SettingsSubPage>
    );
};

const BusinessHours = ({ onBack }) => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const [hours, setHours] = useState(
        days.map(d => ({ day: d, enabled: !['Saturday', 'Sunday'].includes(d), start: '09:00', end: '17:00' }))
    );

    const toggle = idx => {
        const updated = [...hours];
        updated[idx].enabled = !updated[idx].enabled;
        setHours(updated);
    };

    return (
        <SettingsSubPage title="Business Hours" subtitle="Set your organization's working hours for each day" onBack={onBack}>
            <div className="settings-card">
                <div className="settings-card-header">
                    <h3>Weekly Schedule</h3>
                    <p className="settings-card-desc">These hours will be used as default availability for services and staff.</p>
                </div>
                <div className="business-hours-list">
                    {hours.map((h, idx) => (
                        <div key={h.day} className="business-hours-row">
                            <div className="bh-day-toggle">
                                <ToggleSwitch checked={h.enabled} onChange={() => toggle(idx)} />
                                <span className={`bh-day-label ${!h.enabled ? 'bh-disabled' : ''}`}>{h.day}</span>
                            </div>
                            {h.enabled ? (
                                <div className="bh-time-range">
                                    <input type="time" className="bh-time-input" value={h.start} onChange={e => { const u = [...hours]; u[idx].start = e.target.value; setHours(u); }} />
                                    <span className="bh-separator">to</span>
                                    <input type="time" className="bh-time-input" value={h.end} onChange={e => { const u = [...hours]; u[idx].end = e.target.value; setHours(u); }} />
                                </div>
                            ) : (
                                <span className="bh-closed-label">Closed</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
            <SaveBar />
        </SettingsSubPage>
    );
};

const BusinessBookingPage = ({ onBack }) => {
    const [config, setConfig] = useState({
        pageTitle: 'Book an Appointment',
        welcomeMessage: 'Welcome! Choose a service to get started.',
        showStaffPhotos: true,
        showServiceDuration: true,
        showServicePrice: true,
        allowServiceSearch: true,
        theme: 'Light',
        accentColor: '#5C44B5',
        logoUrl: '',
    });

    return (
        <SettingsSubPage title="Business Booking Page" subtitle="Customize the public booking page your customers see" onBack={onBack}>
            <div className="settings-card">
                <div className="settings-card-header">
                    <h3>Page Settings</h3>
                </div>
                <div className="settings-form-grid">
                    <FormField label="Page Title" value={config.pageTitle} onChange={v => setConfig({...config, pageTitle: v})} />
                    <FormField label="Welcome Message" value={config.welcomeMessage} onChange={v => setConfig({...config, welcomeMessage: v})} />
                    <FormField label="Theme" value={config.theme} onChange={v => setConfig({...config, theme: v})} type="select" options={['Light', 'Dark', 'Auto']} />
                    <FormField label="Accent Color" value={config.accentColor} onChange={v => setConfig({...config, accentColor: v})} type="color" />
                </div>
            </div>
            <div className="settings-card" style={{ marginTop: '24px' }}>
                <div className="settings-card-header">
                    <h3>Display Options</h3>
                </div>
                <ToggleRow label="Show Staff Photos" description="Display profile photos of assigned staff members" checked={config.showStaffPhotos} onChange={v => setConfig({...config, showStaffPhotos: v})} />
                <ToggleRow label="Show Service Duration" description="Display duration alongside each service" checked={config.showServiceDuration} onChange={v => setConfig({...config, showServiceDuration: v})} />
                <ToggleRow label="Show Service Price" description="Display pricing information for services" checked={config.showServicePrice} onChange={v => setConfig({...config, showServicePrice: v})} />
                <ToggleRow label="Allow Service Search" description="Enable search bar on the booking page" checked={config.allowServiceSearch} onChange={v => setConfig({...config, allowServiceSearch: v})} />
            </div>
            <SaveBar />
        </SettingsSubPage>
    );
};

const CustomerLoginPreferences = ({ onBack }) => {
    const [prefs, setPrefs] = useState({
        requireLogin: false,
        allowGuestBooking: true,
        loginMethods: ['Email'],
        requirePhoneVerification: false,
        rememberCustomers: true,
        sessionTimeout: '30',
    });

    return (
        <SettingsSubPage title="Customer Login Preferences" subtitle="Configure how customers authenticate when booking" onBack={onBack}>
            <div className="settings-card">
                <div className="settings-card-header"><h3>Authentication Settings</h3></div>
                <ToggleRow label="Require Login to Book" description="Customers must log in before booking an appointment" checked={prefs.requireLogin} onChange={v => setPrefs({...prefs, requireLogin: v})} />
                <ToggleRow label="Allow Guest Booking" description="Allow customers to book without creating an account" checked={prefs.allowGuestBooking} onChange={v => setPrefs({...prefs, allowGuestBooking: v})} />
                <ToggleRow label="Require Phone Verification" description="Verify customer phone number via OTP" checked={prefs.requirePhoneVerification} onChange={v => setPrefs({...prefs, requirePhoneVerification: v})} />
                <ToggleRow label="Remember Returning Customers" description="Pre-fill details for returning customers" checked={prefs.rememberCustomers} onChange={v => setPrefs({...prefs, rememberCustomers: v})} />
            </div>
            <div className="settings-card" style={{ marginTop: '24px' }}>
                <div className="settings-card-header"><h3>Session Settings</h3></div>
                <div className="settings-form-grid">
                    <FormField label="Session Timeout (minutes)" value={prefs.sessionTimeout} onChange={v => setPrefs({...prefs, sessionTimeout: v})} type="select" options={['15', '30', '60', '120']} />
                </div>
            </div>
            <SaveBar />
        </SettingsSubPage>
    );
};

const EmployeesSettings = ({ onBack }) => {
    const [config, setConfig] = useState({
        allowSelfRegistration: false,
        requireApproval: true,
        showOnBookingPage: true,
        allowStaffScheduleEdit: false,
        maxServicesPerStaff: '10',
        defaultRole: 'Staff',
    });

    return (
        <SettingsSubPage title="Employees" subtitle="Configure employee-related settings for your organization" onBack={onBack}>
            <div className="settings-card">
                <div className="settings-card-header"><h3>Employee Management</h3></div>
                <ToggleRow label="Allow Self Registration" description="Employees can register themselves via an invite link" checked={config.allowSelfRegistration} onChange={v => setConfig({...config, allowSelfRegistration: v})} />
                <ToggleRow label="Require Admin Approval" description="New employee registrations need admin approval" checked={config.requireApproval} onChange={v => setConfig({...config, requireApproval: v})} />
                <ToggleRow label="Show on Booking Page" description="Display employees on the public booking page" checked={config.showOnBookingPage} onChange={v => setConfig({...config, showOnBookingPage: v})} />
                <ToggleRow label="Allow Staff Schedule Edit" description="Staff members can modify their own schedule" checked={config.allowStaffScheduleEdit} onChange={v => setConfig({...config, allowStaffScheduleEdit: v})} />
            </div>
            <div className="settings-card" style={{ marginTop: '24px' }}>
                <div className="settings-card-header"><h3>Defaults</h3></div>
                <div className="settings-form-grid">
                    <FormField label="Max Services per Staff" value={config.maxServicesPerStaff} onChange={v => setConfig({...config, maxServicesPerStaff: v})} type="select" options={['5', '10', '15', '20', 'Unlimited']} />
                    <FormField label="Default Role" value={config.defaultRole} onChange={v => setConfig({...config, defaultRole: v})} type="select" options={['Staff', 'Manager', 'Admin']} />
                </div>
            </div>
            <SaveBar />
        </SettingsSubPage>
    );
};

// ===================== MODULES =====================

const OrganizationOverview = ({ onBack }) => {
    return (
        <SettingsSubPage title="Organization Overview" subtitle="View your organization details" onBack={onBack}>
            <div className="settings-card">
                <div className="settings-card-header">
                    <h3>Your Organization</h3>
                </div>
                <div className="settings-list">
                    <div className="settings-list-item">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#a78bfa', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600, fontSize: '14px' }}>
                                B+
                            </div>
                            <div>
                                <div style={{ fontWeight: 500, fontSize: '14px' }}>Bookings+</div>
                                <div style={{ fontSize: '12px', color: 'var(--pk-text-muted)' }}>Single-tenant deployment</div>
                            </div>
                        </div>
                        <span style={{ fontSize: '12px', background: '#dcfce7', color: '#166534', padding: '3px 10px', borderRadius: '9999px', fontWeight: 500 }}>Active</span>
                    </div>
                </div>
            </div>
        </SettingsSubPage>
    );
};

const ResourcesSettings = ({ onBack }) => {
    const [resources] = useState([
        { id: 1, name: 'Meeting Room A', type: 'Room', capacity: 10, available: true },
        { id: 2, name: 'Meeting Room B', type: 'Room', capacity: 6, available: true },
        { id: 3, name: 'Projector - Epson', type: 'Equipment', capacity: null, available: false },
        { id: 4, name: 'Video Camera Kit', type: 'Equipment', capacity: null, available: true },
    ]);

    return (
        <SettingsSubPage title="Resources" subtitle="Manage rooms, equipment, and other bookable resources" onBack={onBack}>
            <div className="settings-card">
                <div className="settings-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3>All Resources</h3>
                    <button className="btn btn-primary" style={{ fontSize: '13px', padding: '6px 16px' }}>+ Add Resource</button>
                </div>
                <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                    <table className="z-table">
                        <thead>
                            <tr>
                                <th className="z-th">Name</th>
                                <th className="z-th">Type</th>
                                <th className="z-th">Capacity</th>
                                <th className="z-th">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {resources.map(r => (
                                <tr key={r.id} className="z-tr" style={{ cursor: 'pointer' }}>
                                    <td className="z-td" style={{ fontWeight: 500 }}>{r.name}</td>
                                    <td className="z-td">{r.type}</td>
                                    <td className="z-td">{r.capacity || '—'}</td>
                                    <td className="z-td">
                                        <span className={`status-badge ${r.available ? 'status-active' : 'status-pending'}`}>
                                            {r.available ? 'Available' : 'Unavailable'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </SettingsSubPage>
    );
};

const InPersonLocations = ({ onBack }) => {
    const locations = [
        { id: 1, name: 'Main Office', address: '123 Business Ave, Suite 100, New York, NY', active: true },
        { id: 2, name: 'Downtown Branch', address: '456 Market St, Floor 3, San Francisco, CA', active: true },
        { id: 3, name: 'Remote Hub', address: '789 Tech Park Rd, Austin, TX', active: false },
    ];

    return (
        <SettingsSubPage title="In-person Locations" subtitle="Manage physical locations where services can be offered" onBack={onBack}>
            <div className="settings-card">
                <div className="settings-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3>Locations</h3>
                    <button className="btn btn-primary" style={{ fontSize: '13px', padding: '6px 16px' }}>+ Add Location</button>
                </div>
                <div className="settings-list">
                    {locations.map(loc => (
                        <div key={loc.id} className="settings-list-item">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <MapPin size={18} color="#4F46E5" />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 500, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {loc.name}
                                        <span className={`status-badge ${loc.active ? 'status-active' : 'status-pending'}`} style={{ fontSize: '11px' }}>
                                            {loc.active ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--pk-text-muted)', marginTop: '2px' }}>{loc.address}</div>
                                </div>
                            </div>
                            <ChevronRight size={16} color="var(--pk-text-muted)" />
                        </div>
                    ))}
                </div>
            </div>
        </SettingsSubPage>
    );
};

const CustomersSettings = ({ onBack }) => {
    const [config, setConfig] = useState({
        allowSelfDeletion: false,
        collectPhone: true,
        collectAddress: false,
        collectNotes: true,
        duplicateDetection: true,
        autoMerge: false,
    });

    return (
        <SettingsSubPage title="Customers" subtitle="Configure customer data collection and management" onBack={onBack}>
            <div className="settings-card">
                <div className="settings-card-header"><h3>Data Collection</h3></div>
                <ToggleRow label="Collect Phone Number" description="Ask for phone number during booking" checked={config.collectPhone} onChange={v => setConfig({...config, collectPhone: v})} />
                <ToggleRow label="Collect Address" description="Ask for physical address during booking" checked={config.collectAddress} onChange={v => setConfig({...config, collectAddress: v})} />
                <ToggleRow label="Collect Notes" description="Allow customers to add notes during booking" checked={config.collectNotes} onChange={v => setConfig({...config, collectNotes: v})} />
            </div>
            <div className="settings-card" style={{ marginTop: '24px' }}>
                <div className="settings-card-header"><h3>Customer Management</h3></div>
                <ToggleRow label="Duplicate Detection" description="Automatically detect duplicate customer records" checked={config.duplicateDetection} onChange={v => setConfig({...config, duplicateDetection: v})} />
                <ToggleRow label="Auto-Merge Duplicates" description="Automatically merge detected duplicate records" checked={config.autoMerge} onChange={v => setConfig({...config, autoMerge: v})} />
                <ToggleRow label="Allow Self-Deletion" description="Customers can request deletion of their data" checked={config.allowSelfDeletion} onChange={v => setConfig({...config, allowSelfDeletion: v})} />
            </div>
            <SaveBar />
        </SettingsSubPage>
    );
};

const ReportsSettings = ({ onBack }) => {
    const [config, setConfig] = useState({
        autoGenerate: true,
        frequency: 'Weekly',
        emailReport: true,
        includeRevenue: true,
        includeCancellations: true,
        includeStaffPerformance: true,
    });

    return (
        <SettingsSubPage title="Reports" subtitle="Configure report generation and delivery preferences" onBack={onBack}>
            <div className="settings-card">
                <div className="settings-card-header"><h3>Report Generation</h3></div>
                <ToggleRow label="Auto-Generate Reports" description="Automatically generate periodic reports" checked={config.autoGenerate} onChange={v => setConfig({...config, autoGenerate: v})} />
                <div className="settings-form-grid" style={{ padding: '0 16px 16px' }}>
                    <FormField label="Report Frequency" value={config.frequency} onChange={v => setConfig({...config, frequency: v})} type="select" options={['Daily', 'Weekly', 'Monthly', 'Quarterly']} />
                </div>
                <ToggleRow label="Email Reports" description="Send generated reports via email to admins" checked={config.emailReport} onChange={v => setConfig({...config, emailReport: v})} />
            </div>
            <div className="settings-card" style={{ marginTop: '24px' }}>
                <div className="settings-card-header"><h3>Report Content</h3></div>
                <ToggleRow label="Include Revenue Metrics" description="Add revenue summary to reports" checked={config.includeRevenue} onChange={v => setConfig({...config, includeRevenue: v})} />
                <ToggleRow label="Include Cancellations" description="Add cancellation data and reasons" checked={config.includeCancellations} onChange={v => setConfig({...config, includeCancellations: v})} />
                <ToggleRow label="Include Staff Performance" description="Add individual staff performance metrics" checked={config.includeStaffPerformance} onChange={v => setConfig({...config, includeStaffPerformance: v})} />
            </div>
            <SaveBar />
        </SettingsSubPage>
    );
};

// ===================== INTEGRATIONS =====================

const IntegrationCard = ({ name, description, icon, connected, onToggle }) => (
    <div className="integration-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div className="integration-icon">{icon}</div>
            <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: '14px' }}>{name}</div>
                <div style={{ fontSize: '12px', color: 'var(--pk-text-muted)', marginTop: '2px' }}>{description}</div>
            </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className={`status-badge ${connected ? 'status-active' : ''}`} style={{ background: connected ? '#dcfce7' : '#f3f4f6', color: connected ? '#166534' : '#6B7280' }}>
                {connected ? 'Connected' : 'Not Connected'}
            </span>
            <button className={`btn ${connected ? 'btn-secondary' : 'btn-primary'}`} style={{ fontSize: '12px', padding: '4px 12px' }} onClick={onToggle}>
                {connected ? 'Configure' : 'Connect'}
            </button>
        </div>
    </div>
);

const MostPopularIntegrations = ({ onBack }) => (
    <SettingsSubPage title="Most Popular" subtitle="Top integrations used by Bookings+ users" onBack={onBack}>
        <div className="integrations-grid">
            <IntegrationCard name="Google Calendar" description="Sync bookings with Google Calendar" icon={<CalendarDays size={20} color="#4285F4" />} connected={true} />
            <IntegrationCard name="Zoom" description="Auto-create Zoom meetings for bookings" icon={<Video size={20} color="#2D8CFF" />} connected={true} />
            <IntegrationCard name="Stripe" description="Accept online payments via Stripe" icon={<CreditCard size={20} color="#635BFF" />} connected={false} />
            <IntegrationCard name="Slack" description="Get booking notifications in Slack" icon={<Bell size={20} color="#E01E5A" />} connected={false} />
            <IntegrationCard name="Zapier" description="Connect with 5000+ apps via Zapier" icon={<Link2 size={20} color="#FF4A00" />} connected={false} />
            <IntegrationCard name="Zoho CRM" description="Sync customer data with Zoho CRM" icon={<TrendingUp size={20} color="#E42527" />} connected={true} />
        </div>
    </SettingsSubPage>
);

const CalendarIntegrations = ({ onBack }) => (
    <SettingsSubPage title="Calendars" subtitle="Connect calendar services to sync appointments" onBack={onBack}>
        <div className="integrations-grid">
            <IntegrationCard name="Google Calendar" description="Two-way sync with Google Calendar" icon={<CalendarDays size={20} color="#4285F4" />} connected={true} />
            <IntegrationCard name="Outlook Calendar" description="Sync with Microsoft Outlook" icon={<CalendarDays size={20} color="#0078D4" />} connected={false} />
            <IntegrationCard name="Apple Calendar" description="Sync with Apple iCal" icon={<CalendarDays size={20} color="#333" />} connected={false} />
            <IntegrationCard name="CalDAV" description="Connect via CalDAV protocol" icon={<CalendarDays size={20} color="#6B7280" />} connected={false} />
        </div>
    </SettingsSubPage>
);

const VideoConferencing = ({ onBack }) => (
    <SettingsSubPage title="Video Conferencing" subtitle="Connect video conferencing tools for virtual appointments" onBack={onBack}>
        <div className="integrations-grid">
            <IntegrationCard name="Zoom" description="Auto-create Zoom meetings for online bookings" icon={<Video size={20} color="#2D8CFF" />} connected={true} />
            <IntegrationCard name="Google Meet" description="Generate Google Meet links automatically" icon={<Video size={20} color="#00897B" />} connected={false} />
            <IntegrationCard name="Microsoft Teams" description="Create Teams meetings for appointments" icon={<Video size={20} color="#6264A7" />} connected={false} />
            <IntegrationCard name="Zoho Meeting" description="Use Zoho Meeting for virtual sessions" icon={<Video size={20} color="#E42527" />} connected={false} />
        </div>
    </SettingsSubPage>
);

const CRMAndSales = ({ onBack }) => (
    <SettingsSubPage title="CRM & Sales" subtitle="Connect CRM tools to sync customer and deal data" onBack={onBack}>
        <div className="integrations-grid">
            <IntegrationCard name="Zoho CRM" description="Sync leads and contacts with Zoho CRM" icon={<TrendingUp size={20} color="#E42527" />} connected={true} />
            <IntegrationCard name="Salesforce" description="Connect Salesforce CRM for lead tracking" icon={<TrendingUp size={20} color="#00A1E0" />} connected={false} />
            <IntegrationCard name="HubSpot" description="Sync contacts and deals with HubSpot" icon={<TrendingUp size={20} color="#FF7A59" />} connected={false} />
            <IntegrationCard name="Pipedrive" description="Connect Pipedrive for sales pipeline" icon={<TrendingUp size={20} color="#20B27E" />} connected={false} />
        </div>
    </SettingsSubPage>
);

const PaymentsIntegrations = ({ onBack }) => (
    <SettingsSubPage title="Payments" subtitle="Connect payment gateways to accept online payments" onBack={onBack}>
        <div className="integrations-grid">
            <IntegrationCard name="Stripe" description="Accept credit/debit card payments" icon={<CreditCard size={20} color="#635BFF" />} connected={false} />
            <IntegrationCard name="PayPal" description="Accept PayPal payments for bookings" icon={<CreditCard size={20} color="#003087" />} connected={false} />
            <IntegrationCard name="Square" description="Process payments via Square" icon={<CreditCard size={20} color="#3E4348" />} connected={false} />
            <IntegrationCard name="Razorpay" description="Accept payments for Indian customers" icon={<CreditCard size={20} color="#2B84EA" />} connected={false} />
        </div>
    </SettingsSubPage>
);

// ===================== PRODUCT CUSTOMIZATIONS =====================

const CustomDomain = ({ onBack }) => {
    const [domain, setDomain] = useState({
        customDomain: '',
        sslEnabled: true,
        status: 'Not Configured',
    });

    return (
        <SettingsSubPage title="Custom Domain" subtitle="Set up a custom domain for your booking page" onBack={onBack}>
            <div className="settings-card">
                <div className="settings-card-header">
                    <h3>Domain Configuration</h3>
                    <p className="settings-card-desc">Map your own domain to the booking page (e.g., bookings.yourcompany.com)</p>
                </div>
                <div className="settings-form-grid">
                    <FormField label="Custom Domain" value={domain.customDomain} onChange={v => setDomain({...domain, customDomain: v})} placeholder="bookings.yourcompany.com" fullWidth />
                </div>
                <div style={{ padding: '0 16px 16px' }}>
                    <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '16px', fontSize: '13px', color: '#92400E' }}>
                        <strong>DNS Setup Required:</strong> Add a CNAME record pointing your domain to <code style={{ background: '#FEF3C7', padding: '2px 6px', borderRadius: '4px' }}>cname.bookingsplus.app</code>
                    </div>
                </div>
                <ToggleRow label="SSL/TLS Encryption" description="Automatically provision SSL certificate for your custom domain" checked={domain.sslEnabled} onChange={v => setDomain({...domain, sslEnabled: v})} />
            </div>
            <SaveBar />
        </SettingsSubPage>
    );
};

const InProductNotifications = ({ onBack }) => {
    const [config, setConfig] = useState({
        emailConfirmation: true,
        emailReminder: true,
        emailCancellation: true,
        smsConfirmation: false,
        smsReminder: false,
        reminderTime: '1 hour before',
        staffNotifyNew: true,
        staffNotifyCancel: true,
        staffNotifyReschedule: true,
    });

    return (
        <SettingsSubPage title="In-product Notifications" subtitle="Configure notification preferences for bookings" onBack={onBack}>
            <div className="settings-card">
                <div className="settings-card-header"><h3>Customer Notifications</h3></div>
                <ToggleRow label="Email Confirmation" description="Send booking confirmation via email" checked={config.emailConfirmation} onChange={v => setConfig({...config, emailConfirmation: v})} />
                <ToggleRow label="Email Reminder" description="Send appointment reminder via email" checked={config.emailReminder} onChange={v => setConfig({...config, emailReminder: v})} />
                <ToggleRow label="Email Cancellation" description="Notify customer when booking is cancelled" checked={config.emailCancellation} onChange={v => setConfig({...config, emailCancellation: v})} />
                <ToggleRow label="SMS Confirmation" description="Send booking confirmation via SMS" checked={config.smsConfirmation} onChange={v => setConfig({...config, smsConfirmation: v})} />
                <ToggleRow label="SMS Reminder" description="Send appointment reminder via SMS" checked={config.smsReminder} onChange={v => setConfig({...config, smsReminder: v})} />
                <div className="settings-form-grid" style={{ padding: '0 16px 16px' }}>
                    <FormField label="Reminder Time" value={config.reminderTime} onChange={v => setConfig({...config, reminderTime: v})} type="select" options={['15 minutes before', '30 minutes before', '1 hour before', '2 hours before', '1 day before']} />
                </div>
            </div>
            <div className="settings-card" style={{ marginTop: '24px' }}>
                <div className="settings-card-header"><h3>Staff Notifications</h3></div>
                <ToggleRow label="New Booking" description="Notify staff when a new booking is made" checked={config.staffNotifyNew} onChange={v => setConfig({...config, staffNotifyNew: v})} />
                <ToggleRow label="Cancellation" description="Notify staff when a booking is cancelled" checked={config.staffNotifyCancel} onChange={v => setConfig({...config, staffNotifyCancel: v})} />
                <ToggleRow label="Reschedule" description="Notify staff when a booking is rescheduled" checked={config.staffNotifyReschedule} onChange={v => setConfig({...config, staffNotifyReschedule: v})} />
            </div>
            <SaveBar />
        </SettingsSubPage>
    );
};

const CustomLabels = ({ onBack }) => {
    const [labels, setLabels] = useState({
        service: 'Service',
        employee: 'Employee',
        customer: 'Customer',
        appointment: 'Appointment',
        booking: 'Booking',
        workspace: 'Workspace',
    });

    return (
        <SettingsSubPage title="Custom Labels" subtitle="Customize terminology used across the application" onBack={onBack}>
            <div className="settings-card">
                <div className="settings-card-header">
                    <h3>Rename Labels</h3>
                    <p className="settings-card-desc">Change default labels to match your business terminology.</p>
                </div>
                <div className="settings-form-grid">
                    {Object.entries(labels).map(([key, val]) => (
                        <FormField key={key} label={`"${key.charAt(0).toUpperCase() + key.slice(1)}" label`} value={val} onChange={v => setLabels({...labels, [key]: v})} />
                    ))}
                </div>
            </div>
            <SaveBar />
        </SettingsSubPage>
    );
};

const RolesAndPermissions = ({ onBack }) => {
    const roles = [
        { name: 'Super Admin', description: 'Full access to all features and settings', users: 1, editable: false },
        { name: 'Admin', description: 'Manage services, staff, and bookings', users: 2, editable: true },
        { name: 'Manager', description: 'Manage team schedules and view reports', users: 3, editable: true },
        { name: 'Staff', description: 'View own schedule and manage assigned bookings', users: 8, editable: true },
    ];

    return (
        <SettingsSubPage title="Roles and Permissions" subtitle="Manage user roles and their access levels" onBack={onBack}>
            <div className="settings-card">
                <div className="settings-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3>Roles</h3>
                    <button className="btn btn-primary" style={{ fontSize: '13px', padding: '6px 16px' }}>+ Add Role</button>
                </div>
                <div className="settings-list">
                    {roles.map(role => (
                        <div key={role.name} className="settings-list-item">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#F3E8FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <ShieldCheck size={18} color="#9333EA" />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 500, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {role.name}
                                        {!role.editable && <span style={{ fontSize: '10px', background: '#DBEAFE', color: '#1E40AF', padding: '1px 6px', borderRadius: '4px' }}>System</span>}
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--pk-text-muted)', marginTop: '2px' }}>{role.description} · {role.users} users</div>
                                </div>
                            </div>
                            {role.editable && <ChevronRight size={16} color="var(--pk-text-muted)" />}
                        </div>
                    ))}
                </div>
            </div>
        </SettingsSubPage>
    );
};

// ===================== DATA ADMINISTRATION =====================

const PrivacyAndSecurity = ({ onBack }) => {
    const [config, setConfig] = useState({
        twoFactorAuth: false,
        sessionExpiry: '30 days',
        ipWhitelist: false,
        dataEncryption: true,
        gdprMode: true,
        cookieConsent: true,
    });

    return (
        <SettingsSubPage title="Privacy and Security" subtitle="Configure security and privacy settings for your organization" onBack={onBack}>
            <div className="settings-card">
                <div className="settings-card-header"><h3>Authentication Security</h3></div>
                <ToggleRow label="Two-Factor Authentication" description="Require 2FA for all admin and staff logins" checked={config.twoFactorAuth} onChange={v => setConfig({...config, twoFactorAuth: v})} />
                <div className="settings-form-grid" style={{ padding: '0 16px 16px' }}>
                    <FormField label="Session Expiry" value={config.sessionExpiry} onChange={v => setConfig({...config, sessionExpiry: v})} type="select" options={['7 days', '14 days', '30 days', '60 days', '90 days']} />
                </div>
                <ToggleRow label="IP Whitelist" description="Restrict access to specific IP addresses" checked={config.ipWhitelist} onChange={v => setConfig({...config, ipWhitelist: v})} />
            </div>
            <div className="settings-card" style={{ marginTop: '24px' }}>
                <div className="settings-card-header"><h3>Data Privacy</h3></div>
                <ToggleRow label="Data Encryption at Rest" description="Encrypt stored data with AES-256" checked={config.dataEncryption} onChange={v => setConfig({...config, dataEncryption: v})} />
                <ToggleRow label="GDPR Compliance Mode" description="Enable GDPR-compliant data handling" checked={config.gdprMode} onChange={v => setConfig({...config, gdprMode: v})} />
                <ToggleRow label="Cookie Consent Banner" description="Show cookie consent popup to visitors" checked={config.cookieConsent} onChange={v => setConfig({...config, cookieConsent: v})} />
            </div>
            <SaveBar />
        </SettingsSubPage>
    );
};

const DomainAuthentication = ({ onBack }) => {
    const [config, setConfig] = useState({
        spfRecord: true,
        dkimRecord: false,
        dmarcPolicy: 'none',
        senderDomain: '',
    });

    return (
        <SettingsSubPage title="Domain Authentication" subtitle="Authenticate your email domain for reliable email delivery" onBack={onBack}>
            <div className="settings-card">
                <div className="settings-card-header">
                    <h3>Email Domain Authentication</h3>
                    <p className="settings-card-desc">Set up SPF, DKIM, and DMARC records to ensure booking emails reach your customers.</p>
                </div>
                <div className="settings-form-grid" style={{ padding: '0 16px' }}>
                    <FormField label="Sender Domain" value={config.senderDomain} onChange={v => setConfig({...config, senderDomain: v})} placeholder="mail.yourcompany.com" fullWidth />
                </div>
                <ToggleRow label="SPF Record" description="Sender Policy Framework configured" checked={config.spfRecord} onChange={v => setConfig({...config, spfRecord: v})} />
                <ToggleRow label="DKIM Signing" description="DomainKeys Identified Mail for email signing" checked={config.dkimRecord} onChange={v => setConfig({...config, dkimRecord: v})} />
                <div className="settings-form-grid" style={{ padding: '0 16px 16px' }}>
                    <FormField label="DMARC Policy" value={config.dmarcPolicy} onChange={v => setConfig({...config, dmarcPolicy: v})} type="select" options={['none', 'quarantine', 'reject']} />
                </div>
            </div>
            <SaveBar />
        </SettingsSubPage>
    );
};

const ExportSettings = ({ onBack }) => {
    const exports = [
        { label: 'Appointments', description: 'Export all appointment records', icon: <CalendarDays size={18} /> },
        { label: 'Customers', description: 'Export customer database', icon: <Users size={18} /> },
        { label: 'Services', description: 'Export service configurations', icon: <LayoutGrid size={18} /> },
        { label: 'Staff', description: 'Export employee records', icon: <Users size={18} /> },
        { label: 'Revenue Reports', description: 'Export financial data', icon: <CreditCard size={18} /> },
    ];

    return (
        <SettingsSubPage title="Export" subtitle="Export your data in various formats" onBack={onBack}>
            <div className="settings-card">
                <div className="settings-card-header"><h3>Data Export</h3></div>
                <div className="settings-list">
                    {exports.map(exp => (
                        <div key={exp.label} className="settings-list-item">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16A34A' }}>
                                    {exp.icon}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 500, fontSize: '14px' }}>{exp.label}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--pk-text-muted)' }}>{exp.description}</div>
                                </div>
                            </div>
                            <button className="btn btn-secondary" style={{ fontSize: '12px', padding: '4px 12px' }}>
                                <Download size={14} /> Export CSV
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </SettingsSubPage>
    );
};

const AuditLog = ({ onBack }) => {
    const logs = [
        { id: 1, action: 'Updated Business Hours', user: 'Admin User', timestamp: '2025-01-15 10:30 AM', category: 'Settings' },
        { id: 2, action: 'Created Service "Consultation"', user: 'Admin User', timestamp: '2025-01-15 09:15 AM', category: 'Service' },
        { id: 3, action: 'Added Employee "Jason Miller"', user: 'Admin User', timestamp: '2025-01-14 03:45 PM', category: 'Employee' },
        { id: 4, action: 'Connected Google Calendar', user: 'Admin User', timestamp: '2025-01-14 02:00 PM', category: 'Integration' },
        { id: 5, action: 'Modified Notification Settings', user: 'Admin User', timestamp: '2025-01-13 11:20 AM', category: 'Settings' },
        { id: 6, action: 'Exported Customer Data', user: 'Admin User', timestamp: '2025-01-13 10:00 AM', category: 'Export' },
        { id: 7, action: 'Updated Roles & Permissions', user: 'Admin User', timestamp: '2025-01-12 04:30 PM', category: 'Settings' },
    ];

    const categoryColor = {
        Settings: { bg: '#EEF2FF', color: '#4F46E5' },
        Service: { bg: '#F0FDF4', color: '#16A34A' },
        Employee: { bg: '#FEF3C7', color: '#D97706' },
        Integration: { bg: '#F3E8FF', color: '#9333EA' },
        Export: { bg: '#DBEAFE', color: '#2563EB' },
    };

    return (
        <SettingsSubPage title="Audit Log" subtitle="Track all changes and actions performed in your organization" onBack={onBack}>
            <div className="settings-card">
                <div className="settings-card-header"><h3>Recent Activity</h3></div>
                <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                    <table className="z-table">
                        <thead>
                            <tr>
                                <th className="z-th">Action</th>
                                <th className="z-th">Category</th>
                                <th className="z-th">User</th>
                                <th className="z-th">Timestamp</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map(log => (
                                <tr key={log.id} className="z-tr">
                                    <td className="z-td" style={{ fontWeight: 500 }}>{log.action}</td>
                                    <td className="z-td">
                                        <span style={{
                                            background: categoryColor[log.category]?.bg || '#f3f4f6',
                                            color: categoryColor[log.category]?.color || '#6B7280',
                                            padding: '3px 10px',
                                            borderRadius: '9999px',
                                            fontSize: '12px',
                                            fontWeight: 500,
                                        }}>
                                            {log.category}
                                        </span>
                                    </td>
                                    <td className="z-td">{log.user}</td>
                                    <td className="z-td" style={{ color: 'var(--pk-text-muted)' }}>{log.timestamp}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </SettingsSubPage>
    );
};


/* ─── Reusable Components ─── */

const ToggleSwitch = ({ checked, onChange }) => (
    <div
        onClick={() => onChange(!checked)}
        style={{
            width: '40px', height: '22px', borderRadius: '12px', padding: '2px',
            backgroundColor: checked ? 'var(--pk-primary)' : '#D1D5DB',
            cursor: 'pointer', transition: 'background-color 0.2s', flexShrink: 0,
            display: 'flex', alignItems: 'center',
        }}
    >
        <div style={{
            width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#fff',
            transition: 'transform 0.2s', transform: checked ? 'translateX(18px)' : 'translateX(0)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        }} />
    </div>
);

const ToggleRow = ({ label, description, checked, onChange }) => (
    <div className="toggle-row">
        <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500, fontSize: '14px', color: 'var(--pk-text-main)' }}>{label}</div>
            {description && <div style={{ fontSize: '12px', color: 'var(--pk-text-muted)', marginTop: '2px' }}>{description}</div>}
        </div>
        <ToggleSwitch checked={checked} onChange={onChange} />
    </div>
);

const FormField = ({ label, value, onChange, type = 'text', options, placeholder, fullWidth }) => (
    <div className={`settings-form-field ${fullWidth ? 'full-width' : ''}`}>
        <label className="settings-form-label">{label}</label>
        {type === 'select' ? (
            <select className="settings-form-input" value={value} onChange={e => onChange(e.target.value)}>
                {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
        ) : type === 'color' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="color" value={value} onChange={e => onChange(e.target.value)} style={{ width: '36px', height: '36px', border: 'none', cursor: 'pointer', borderRadius: '6px' }} />
                <input className="settings-form-input" value={value} onChange={e => onChange(e.target.value)} />
            </div>
        ) : (
            <input className="settings-form-input" type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
        )}
    </div>
);

const SaveBar = () => (
    <div className="settings-save-bar">
        <button className="btn btn-secondary">Cancel</button>
        <button className="btn btn-primary">Save Changes</button>
    </div>
);

const SettingsSubPage = ({ title, subtitle, onBack, children }) => (
    <div className="settings-subpage">
        <div className="settings-subpage-header">
            <button className="settings-back-btn" onClick={onBack}>
                <ArrowLeft size={18} />
                <span>Back to Admin Center</span>
            </button>
            <div>
                <h1 className="page-title" style={{ fontSize: '20px', marginBottom: '4px' }}>{title}</h1>
                {subtitle && <p className="page-subtitle">{subtitle}</p>}
            </div>
        </div>
        <div className="settings-subpage-content">
            {children}
        </div>
    </div>
);


/* ─── Settings Categories Data ─── */

const settingsCategories = [
    {
        id: 'organization',
        title: 'Organization',
        icon: <Building2 size={22} />,
        iconBg: '#EEF2FF',
        iconColor: '#4F46E5',
        items: [
            { id: 'basic-info', label: 'Basic Information' },
            { id: 'business-hours', label: 'Business Hours' },
            { id: 'business-booking-page', label: 'Business Booking Page' },
            { id: 'customer-login-prefs', label: 'Customer Login Preferences' },
            { id: 'employees-settings', label: 'Employees' },
        ]
    },
    {
        id: 'modules',
        title: 'Modules',
        icon: <LayoutGrid size={22} />,
        iconBg: '#EEF2FF',
        iconColor: '#4F46E5',
        items: [
            { id: 'organization-overview', label: 'Organization Overview' },
            { id: 'resources', label: 'Resources' },
            { id: 'in-person-locations', label: 'In-person Locations' },
            { id: 'customers-settings', label: 'Customers' },
            { id: 'reports', label: 'Reports' },
        ]
    },
    {
        id: 'integrations',
        title: 'Integrations',
        icon: <Puzzle size={22} />,
        iconBg: '#EEF2FF',
        iconColor: '#4F46E5',
        items: [
            { id: 'most-popular', label: 'Most Popular' },
            { id: 'calendars', label: 'Calendars' },
            { id: 'video-conferencing', label: 'Video Conferencing' },
            { id: 'crm-sales', label: 'CRM & Sales' },
            { id: 'payments', label: 'Payments' },
        ]
    },
    {
        id: 'product-customizations',
        title: 'Product Customizations',
        icon: <Palette size={22} />,
        iconBg: '#EEF2FF',
        iconColor: '#4F46E5',
        items: [
            { id: 'custom-domain', label: 'Custom Domain' },
            { id: 'in-product-notifications', label: 'In-product Notifications' },
            { id: 'custom-labels', label: 'Custom Labels' },
            { id: 'roles-permissions', label: 'Roles and Permissions' },
        ]
    },
    {
        id: 'data-administration',
        title: 'Data Administration',
        icon: <ShieldCheck size={22} />,
        iconBg: '#EEF2FF',
        iconColor: '#4F46E5',
        items: [
            { id: 'privacy-security', label: 'Privacy and Security' },
            { id: 'domain-authentication', label: 'Domain Authentication' },
            { id: 'export', label: 'Export' },
            { id: 'audit-log', label: 'Audit Log' },
        ]
    },
];

/* ─── Sub-page Router ─── */

const subPageMap = {
    'basic-info': BasicInformation,
    'business-hours': BusinessHours,
    'business-booking-page': BusinessBookingPage,
    'customer-login-prefs': CustomerLoginPreferences,
    'employees-settings': EmployeesSettings,
    'organization-overview': OrganizationOverview,
    'resources': ResourcesSettings,
    'in-person-locations': InPersonLocations,
    'customers-settings': CustomersSettings,
    'reports': ReportsSettings,
    'most-popular': MostPopularIntegrations,
    'calendars': CalendarIntegrations,
    'video-conferencing': VideoConferencing,
    'crm-sales': CRMAndSales,
    'payments': PaymentsIntegrations,
    'custom-domain': CustomDomain,
    'in-product-notifications': InProductNotifications,
    'custom-labels': CustomLabels,
    'roles-permissions': RolesAndPermissions,
    'privacy-security': PrivacyAndSecurity,
    'domain-authentication': DomainAuthentication,
    'export': ExportSettings,
    'audit-log': AuditLog,
};


/* ─── Main Settings Page ─── */

const Settings = () => {
    const [activeSubPage, setActiveSubPage] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // If a sub-page is active, render it
    if (activeSubPage) {
        const SubPageComponent = subPageMap[activeSubPage];
        if (SubPageComponent) {
            return <SubPageComponent onBack={() => setActiveSubPage(null)} />;
        }
    }

    // Filter categories by search
    const filteredCategories = settingsCategories.map(cat => ({
        ...cat,
        items: cat.items.filter(item =>
            item.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
            cat.title.toLowerCase().includes(searchTerm.toLowerCase())
        )
    })).filter(cat => cat.items.length > 0);

    return (
        <div className="settings-page">
            {/* Header */}
            <div className="settings-header">
                <div className="settings-header-left">
                    <h1 className="settings-title">Admin Center</h1>
                </div>
                <div className="settings-search-container">
                    <Search size={16} className="settings-search-icon" />
                    <input
                        type="text"
                        className="settings-search-input"
                        placeholder="Search"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Settings Cards Grid */}
            <div className="settings-categories-grid">
                {filteredCategories.map(category => (
                    <div key={category.id} className="settings-category-card">
                        <div className="settings-category-header">
                            <div className="settings-category-icon" style={{ backgroundColor: category.iconBg, color: category.iconColor }}>
                                {category.icon}
                            </div>
                            <h2 className="settings-category-title">{category.title}</h2>
                        </div>
                        <div className="settings-category-items">
                            {category.items.map(item => (
                                <button
                                    key={item.id}
                                    className="settings-category-link"
                                    onClick={() => setActiveSubPage(item.id)}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Settings;
