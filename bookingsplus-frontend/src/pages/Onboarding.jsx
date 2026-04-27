import React, { useState, useEffect, useRef } from 'react';
import {
    Building2, Clock, Briefcase, Users, CheckCircle2, ChevronRight,
    ChevronLeft, Plus, Trash2, ArrowRight, Sparkles, AlertCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { organizationsApi, servicesApi, usersApi } from '../services';
import { STORAGE_KEYS } from '../constants';

/* ═══════════════════════════════════════════════════════════════════
   ONBOARDING WIZARD — Production-grade multi-step setup flow
   Inspired by Zoho Bookings first-time setup experience.
   
   Steps:
   1. Organization + Workspace naming
   2. Business Hours configuration
   3. Create first Service
   4. Add Staff members
   5. Setup Complete → redirect to dashboard
   ═══════════════════════════════════════════════════════════════════ */

const STEPS = [
    { id: 'organization', label: 'Organization', icon: Building2, description: 'Name your business' },
    { id: 'hours', label: 'Business Hours', icon: Clock, description: 'Set your availability' },
    { id: 'service', label: 'First Service', icon: Briefcase, description: 'Create a bookable service' },
    { id: 'staff', label: 'Staff', icon: Users, description: 'Add your team' },
    { id: 'complete', label: 'All Set!', icon: CheckCircle2, description: 'You\'re ready to go' },
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const TIMEZONES = [
    { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST, GMT +05:30)' },
    { value: 'America/New_York', label: 'America/New_York (EST, GMT -05:00)' },
    { value: 'America/Chicago', label: 'America/Chicago (CST, GMT -06:00)' },
    { value: 'America/Denver', label: 'America/Denver (MST, GMT -07:00)' },
    { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST, GMT -08:00)' },
    { value: 'Europe/London', label: 'Europe/London (GMT +00:00)' },
    { value: 'Europe/Paris', label: 'Europe/Paris (CET, GMT +01:00)' },
    { value: 'Europe/Berlin', label: 'Europe/Berlin (CET, GMT +01:00)' },
    { value: 'Asia/Dubai', label: 'Asia/Dubai (GST, GMT +04:00)' },
    { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT, GMT +08:00)' },
    { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST, GMT +09:00)' },
    { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST, GMT +10:00)' },
    { value: 'Pacific/Auckland', label: 'Pacific/Auckland (NZST, GMT +12:00)' },
    { value: 'UTC', label: 'UTC (GMT +00:00)' },
];

const CURRENCIES = [
    { value: 'USD', label: 'USD — US Dollar ($)' },
    { value: 'EUR', label: 'EUR — Euro (€)' },
    { value: 'GBP', label: 'GBP — British Pound (£)' },
    { value: 'INR', label: 'INR — Indian Rupee (₹)' },
    { value: 'AUD', label: 'AUD — Australian Dollar (A$)' },
    { value: 'CAD', label: 'CAD — Canadian Dollar (C$)' },
    { value: 'JPY', label: 'JPY — Japanese Yen (¥)' },
    { value: 'SGD', label: 'SGD — Singapore Dollar (S$)' },
    { value: 'AED', label: 'AED — UAE Dirham (د.إ)' },
];

const INDUSTRIES = [
    'Professional Services', 'Healthcare', 'Education', 'Technology',
    'Finance', 'Real Estate', 'Fitness & Wellness', 'Beauty & Spa',
    'Legal Services', 'Consulting', 'Automotive', 'Other'
];

/* ─── Helper Components ─── */

const ToggleSwitch = ({ checked, onChange, size = 'md' }) => {
    const w = size === 'sm' ? 36 : 44;
    const h = size === 'sm' ? 20 : 24;
    const dot = size === 'sm' ? 16 : 20;
    const travel = w - dot - 4;
    return (
        <div
            onClick={() => onChange(!checked)}
            style={{
                width: `${w}px`, height: `${h}px`, borderRadius: `${h}px`, padding: '2px',
                backgroundColor: checked ? '#5C44B5' : '#D1D5DB',
                cursor: 'pointer', transition: 'background-color 0.2s', flexShrink: 0,
                display: 'flex', alignItems: 'center',
            }}
        >
            <div style={{
                width: `${dot}px`, height: `${dot}px`, borderRadius: '50%', backgroundColor: '#fff',
                transition: 'transform 0.2s', transform: checked ? `translateX(${travel}px)` : 'translateX(0)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }} />
        </div>
    );
};

const ErrorBanner = ({ message, onDismiss }) => {
    if (!message) return null;
    return (
        <div style={{
            backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px',
            padding: '14px 18px', marginBottom: '20px', display: 'flex', alignItems: 'flex-start', gap: '10px',
            animation: 'fadeIn 0.2s ease',
        }}>
            <AlertCircle size={18} color="#DC2626" style={{ flexShrink: 0, marginTop: '1px' }} />
            <p style={{ fontSize: '13px', color: '#991B1B', margin: 0, lineHeight: '1.5', flex: 1 }}>{message}</p>
            {onDismiss && (
                <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#DC2626', fontSize: '18px', lineHeight: 1 }}>×</button>
            )}
        </div>
    );
};

/* ═════════ STEP 1: ORGANIZATION ═════════ */

const StepOrganization = ({ data, onChange }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
            <label style={labelStyle}>Organization Name <span style={{ color: '#EF4444' }}>*</span></label>
            <input
                type="text"
                value={data.orgName}
                onChange={e => onChange({ ...data, orgName: e.target.value })}
                placeholder="e.g. Acme Consulting Group"
                style={inputStyle}
                autoFocus
            />
            <p style={hintStyle}>This is your company or business name.</p>
        </div>
        <div>
            <label style={labelStyle}>Workspace Name</label>
            <input
                type="text"
                value={data.wsName}
                onChange={e => onChange({ ...data, wsName: e.target.value })}
                placeholder={data.orgName || 'Main Branch'}
                style={inputStyle}
            />
            <p style={hintStyle}>Your first workspace. You can add more later. Defaults to organization name.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
                <label style={labelStyle}>Industry</label>
                <select value={data.industry} onChange={e => onChange({ ...data, industry: e.target.value })} style={inputStyle}>
                    <option value="">Select industry</option>
                    {INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                </select>
            </div>
            <div>
                <label style={labelStyle}>Timezone</label>
                <select value={data.timezone} onChange={e => onChange({ ...data, timezone: e.target.value })} style={inputStyle}>
                    {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                </select>
            </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
                <label style={labelStyle}>Currency</label>
                <select value={data.currency} onChange={e => onChange({ ...data, currency: e.target.value })} style={inputStyle}>
                    {CURRENCIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
            </div>
            <div>
                <label style={labelStyle}>Phone Number</label>
                <input
                    type="tel"
                    value={data.phone}
                    onChange={e => onChange({ ...data, phone: e.target.value })}
                    placeholder="+1 (555) 123-4567"
                    style={inputStyle}
                />
            </div>
        </div>
    </div>
);

/* ═════════ STEP 2: BUSINESS HOURS ═════════ */

const StepBusinessHours = ({ data, onChange }) => {
    const toggle = (idx) => {
        const updated = [...data.hours];
        updated[idx] = { ...updated[idx], enabled: !updated[idx].enabled };
        onChange({ ...data, hours: updated });
    };
    const updateTime = (idx, field, value) => {
        const updated = [...data.hours];
        updated[idx] = { ...updated[idx], [field]: value };
        onChange({ ...data, hours: updated });
    };
    const applyToAll = () => {
        const firstEnabled = data.hours.find(h => h.enabled);
        if (!firstEnabled) return;
        const updated = data.hours.map(h => ({
            ...h,
            start: h.enabled ? firstEnabled.start : h.start,
            end: h.enabled ? firstEnabled.end : h.end,
        }));
        onChange({ ...data, hours: updated });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{
                backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px',
                padding: '14px 18px', fontSize: '13px', color: '#166534', display: 'flex', alignItems: 'center', gap: '10px'
            }}>
                <Sparkles size={16} />
                <span>Set your weekly availability. Customers can only book during these hours.</span>
            </div>

            <div style={{
                backgroundColor: 'white', border: '1px solid #E5E7EB', borderRadius: '12px', overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    display: 'grid', gridTemplateColumns: '200px 1fr auto',
                    padding: '12px 20px', borderBottom: '1px solid #E5E7EB', backgroundColor: '#F8FAFC'
                }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Day</span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hours</span>
                    <button onClick={applyToAll} style={{
                        background: 'none', border: 'none', fontSize: '12px', color: '#5C44B5',
                        fontWeight: 600, cursor: 'pointer', padding: 0
                    }}>
                        Apply first to all
                    </button>
                </div>
                {/* Rows */}
                {data.hours.map((h, idx) => (
                    <div key={h.day} style={{
                        display: 'grid', gridTemplateColumns: '200px 1fr', alignItems: 'center',
                        padding: '14px 20px', borderBottom: idx < data.hours.length - 1 ? '1px solid #F3F4F6' : 'none',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <ToggleSwitch checked={h.enabled} onChange={() => toggle(idx)} size="sm" />
                            <span style={{
                                fontSize: '14px', fontWeight: 500,
                                color: h.enabled ? '#111827' : '#9CA3AF',
                            }}>{h.day}</span>
                        </div>
                        {h.enabled ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <input type="time" value={h.start} onChange={e => updateTime(idx, 'start', e.target.value)}
                                    style={{
                                        padding: '7px 12px', border: '1px solid #D1D5DB', borderRadius: '6px',
                                        fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: '#FAFAFA'
                                    }}
                                />
                                <span style={{ fontSize: '13px', color: '#6B7280' }}>to</span>
                                <input type="time" value={h.end} onChange={e => updateTime(idx, 'end', e.target.value)}
                                    style={{
                                        padding: '7px 12px', border: '1px solid #D1D5DB', borderRadius: '6px',
                                        fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: '#FAFAFA'
                                    }}
                                />
                            </div>
                        ) : (
                            <span style={{ fontSize: '13px', color: '#9CA3AF', fontStyle: 'italic' }}>Closed</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

/* ═════════ STEP 3: FIRST SERVICE ═════════ */

const StepService = ({ data, onChange }) => {
    const updateService = (field, value) => {
        onChange({ ...data, service: { ...data.service, [field]: value } });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{
                backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '10px',
                padding: '14px 18px', fontSize: '13px', color: '#1E40AF', display: 'flex', alignItems: 'center', gap: '10px'
            }}>
                <Briefcase size={16} />
                <span>Create your first bookable service. You can add more anytime from the Services page.</span>
            </div>

            <div>
                <label style={labelStyle}>Service Name <span style={{ color: '#EF4444' }}>*</span></label>
                <input
                    type="text"
                    value={data.service.name}
                    onChange={e => updateService('name', e.target.value)}
                    placeholder="e.g. 30-Minute Consultation, Yoga Class, Haircut"
                    style={inputStyle}
                    autoFocus
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                    <label style={labelStyle}>Duration</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <select value={data.service.durationHours} onChange={e => updateService('durationHours', e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                            {[0, 1, 2, 3, 4, 5].map(h => <option key={h} value={h}>{h} hr{h !== 1 ? 's' : ''}</option>)}
                        </select>
                        <select value={data.service.durationMinutes} onChange={e => updateService('durationMinutes', e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                            {[0, 15, 30, 45].map(m => <option key={m} value={m}>{m} min</option>)}
                        </select>
                    </div>
                </div>
                <div>
                    <label style={labelStyle}>Service Type</label>
                    <select value={data.service.type} onChange={e => updateService('type', e.target.value)} style={inputStyle}>
                        <option value="one-on-one">One-on-One</option>
                        <option value="group">Group Booking</option>
                        <option value="collective">Collective Booking</option>
                        <option value="resource">Resource</option>
                    </select>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                    <label style={labelStyle}>Price</label>
                    <div style={{ display: 'flex' }}>
                        <div style={{
                            padding: '10px 14px', background: '#F3F4F6', border: '1px solid #D1D5DB',
                            borderRadius: '8px 0 0 8px', color: '#6B7280', fontSize: '14px',
                            borderRight: 'none', display: 'flex', alignItems: 'center'
                        }}>$</div>
                        <input
                            type="number"
                            value={data.service.price}
                            onChange={e => updateService('price', e.target.value)}
                            placeholder="0.00"
                            style={{ ...inputStyle, borderRadius: '0 8px 8px 0' }}
                            min="0"
                            step="0.01"
                        />
                    </div>
                    <p style={hintStyle}>Set to 0 for free services.</p>
                </div>
                <div>
                    <label style={labelStyle}>Meeting Mode</label>
                    <div style={{ display: 'flex', gap: '0', border: '1px solid #D1D5DB', borderRadius: '8px', overflow: 'hidden' }}>
                        {['Online', 'In-Person', 'Both'].map(mode => (
                            <button
                                key={mode}
                                onClick={() => updateService('meetingMode', mode)}
                                style={{
                                    flex: 1, padding: '10px 8px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
                                    fontFamily: 'inherit', transition: 'all 0.15s',
                                    backgroundColor: data.service.meetingMode === mode ? '#F3F0FF' : 'white',
                                    color: data.service.meetingMode === mode ? '#5C44B5' : '#6B7280',
                                    borderRight: mode !== 'Both' ? '1px solid #E5E7EB' : 'none',
                                }}
                            >{mode}</button>
                        ))}
                    </div>
                </div>
            </div>

            <div>
                <label style={labelStyle}>Description</label>
                <textarea
                    value={data.service.description}
                    onChange={e => updateService('description', e.target.value)}
                    placeholder="Brief description of the service for your customers..."
                    rows={3}
                    style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }}
                />
            </div>
        </div>
    );
};

/* ═════════ STEP 4: STAFF ═════════ */

const StepStaff = ({ data, onChange }) => {
    const addStaffRow = () => {
        onChange({
            ...data,
            staffList: [...data.staffList, { name: '', email: '', role: 'Staff', id: Date.now() }]
        });
    };
    const removeStaffRow = (idx) => {
        onChange({ ...data, staffList: data.staffList.filter((_, i) => i !== idx) });
    };
    const updateStaff = (idx, field, value) => {
        const updated = [...data.staffList];
        updated[idx] = { ...updated[idx], [field]: value };
        onChange({ ...data, staffList: updated });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{
                backgroundColor: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '10px',
                padding: '14px 18px', fontSize: '13px', color: '#92400E', display: 'flex', alignItems: 'center', gap: '10px'
            }}>
                <Users size={16} />
                <span>Add your team members. They'll receive an invite email to join your workspace. You can skip this and add staff later.</span>
            </div>

            {data.staffList.length === 0 ? (
                <div style={{
                    border: '2px dashed #D1D5DB', borderRadius: '12px', padding: '48px', textAlign: 'center',
                    backgroundColor: '#FAFAFA',
                }}>
                    <Users size={40} color="#9CA3AF" style={{ marginBottom: '12px' }} />
                    <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '16px' }}>
                        No staff members added yet.
                    </p>
                    <button onClick={addStaffRow} style={{
                        ...btnPrimaryStyle, padding: '10px 28px',
                    }}>
                        <Plus size={16} /> Add First Staff Member
                    </button>
                </div>
            ) : (
                <>
                    <div style={{
                        backgroundColor: 'white', border: '1px solid #E5E7EB', borderRadius: '12px', overflow: 'hidden'
                    }}>
                        {/* Header */}
                        <div style={{
                            display: 'grid', gridTemplateColumns: '1.5fr 2fr 1fr 40px',
                            padding: '12px 20px', borderBottom: '1px solid #E5E7EB', backgroundColor: '#F8FAFC', gap: '12px',
                        }}>
                            <span style={tableHeaderStyle}>Name</span>
                            <span style={tableHeaderStyle}>Email</span>
                            <span style={tableHeaderStyle}>Role</span>
                            <span />
                        </div>
                        {/* Rows */}
                        {data.staffList.map((staff, idx) => (
                            <div key={staff.id} style={{
                                display: 'grid', gridTemplateColumns: '1.5fr 2fr 1fr 40px',
                                padding: '10px 20px', borderBottom: idx < data.staffList.length - 1 ? '1px solid #F3F4F6' : 'none',
                                gap: '12px', alignItems: 'center',
                            }}>
                                <input
                                    type="text"
                                    value={staff.name}
                                    onChange={e => updateStaff(idx, 'name', e.target.value)}
                                    placeholder="Full name"
                                    style={tableInputStyle}
                                />
                                <input
                                    type="email"
                                    value={staff.email}
                                    onChange={e => updateStaff(idx, 'email', e.target.value)}
                                    placeholder="email@example.com"
                                    style={tableInputStyle}
                                />
                                <select
                                    value={staff.role}
                                    onChange={e => updateStaff(idx, 'role', e.target.value)}
                                    style={tableInputStyle}
                                >
                                    <option value="Staff">Staff</option>
                                    <option value="Manager">Manager</option>
                                    <option value="Admin">Admin</option>
                                </select>
                                <button onClick={() => removeStaffRow(idx)} style={{
                                    background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                                    color: '#9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    borderRadius: '6px', transition: 'all 0.15s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.backgroundColor = '#FEF2F2'; }}
                                onMouseLeave={e => { e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                    <button onClick={addStaffRow} style={{
                        display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: '1px dashed #D1D5DB',
                        borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', color: '#5C44B5',
                        fontSize: '14px', fontWeight: 500, fontFamily: 'inherit', transition: 'all 0.15s',
                        width: '100%', justifyContent: 'center',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#5C44B5'; e.currentTarget.style.backgroundColor = '#F5F3FF'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                        <Plus size={16} /> Add Another
                    </button>
                </>
            )}
        </div>
    );
};

/* ═════════ STEP 5: COMPLETE ═════════ */

const StepComplete = ({ data }) => {
    const serviceCreated = data.service.name.trim();
    const staffAdded = data.staffList.filter(s => s.email.trim()).length;

    return (
        <div style={{ textAlign: 'center', padding: '20px 0 0' }}>
            <div style={{
                width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#DCFCE7',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px',
                animation: 'fadeIn 0.4s ease',
            }}>
                <CheckCircle2 size={40} color="#16A34A" />
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px', color: '#111827' }}>
                You're all set!
            </h2>
            <p style={{ fontSize: '15px', color: '#6B7280', marginBottom: '32px', maxWidth: '440px', margin: '0 auto 32px' }}>
                Your booking workspace is ready. Here's a summary of what was configured:
            </p>

            <div style={{
                backgroundColor: 'white', border: '1px solid #E5E7EB', borderRadius: '12px',
                padding: '24px', textAlign: 'left', maxWidth: '480px', margin: '0 auto',
                display: 'flex', flexDirection: 'column', gap: '16px',
            }}>
                <SummaryRow icon={<Building2 size={18} color="#5C44B5" />} label="Organization" value={data.orgName} />
                <SummaryRow icon={<Clock size={18} color="#D97706" />} label="Business Hours"
                    value={`${data.hours.filter(h => h.enabled).length} days configured`} />
                {serviceCreated ? (
                    <SummaryRow icon={<Briefcase size={18} color="#16A34A" />} label="First Service" value={data.service.name} />
                ) : (
                    <SummaryRow icon={<Briefcase size={18} color="#9CA3AF" />} label="First Service" value="Skipped — add later" muted />
                )}
                {staffAdded > 0 ? (
                    <SummaryRow icon={<Users size={18} color="#2563EB" />} label="Staff Members" value={`${staffAdded} member${staffAdded > 1 ? 's' : ''} invited`} />
                ) : (
                    <SummaryRow icon={<Users size={18} color="#9CA3AF" />} label="Staff Members" value="Skipped — add later" muted />
                )}
            </div>
        </div>
    );
};

const SummaryRow = ({ icon, label, value, muted }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{
            width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#F5F3FF',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>{icon}</div>
        <div style={{ flex: 1 }}>
            <div style={{ fontSize: '12px', color: '#6B7280', fontWeight: 500 }}>{label}</div>
            <div style={{ fontSize: '14px', fontWeight: 500, color: muted ? '#9CA3AF' : '#111827', fontStyle: muted ? 'italic' : 'normal' }}>{value}</div>
        </div>
    </div>
);

/* ═════════ MAIN WIZARD ═════════ */

const Onboarding = () => {
    const { user, refreshUser, setupCompleted, markSetupComplete } = useAuth();
    const { activeWorkspace, refreshWorkspaces } = useWorkspace();
    const [currentStep, setCurrentStep] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [stepErrors, setStepErrors] = useState({});
    const contentRef = useRef(null);

    // Wizard data
    const [data, setData] = useState({
        orgName: '',
        wsName: '',
        industry: '',
        timezone: 'UTC',
        currency: 'USD',
        phone: '',
        hours: DAYS.map(d => ({
            day: d,
            enabled: !['Saturday', 'Sunday'].includes(d),
            start: '09:00',
            end: '17:00',
        })),
        service: {
            name: '',
            durationHours: '0',
            durationMinutes: '30',
            type: 'one-on-one',
            price: '0',
            meetingMode: 'Online',
            description: '',
        },
        staffList: [],
    });

    // Track if org was already created (so we don't recreate on back/forward)
    const [orgCreated, setOrgCreated] = useState(false);
    const [workspaceSlug, setWorkspaceSlug] = useState(null);

    // If org already exists (e.g. user reloaded page mid-wizard), skip step 0
    useEffect(() => {
        if (setupCompleted && !orgCreated) {
            setOrgCreated(true);
            if (currentStep === 0) {
                setCurrentStep(1);
            }
            // Pre-fill org name from workspace if available
            if (activeWorkspace?.workspace_name && !data.orgName) {
                setData(prev => ({
                    ...prev,
                    orgName: activeWorkspace.workspace_name,
                    wsName: activeWorkspace.workspace_name,
                }));
            }
            if (activeWorkspace?.workspace_slug) {
                setWorkspaceSlug(activeWorkspace.workspace_slug);
            }
        }
    }, [setupCompleted]); // eslint-disable-line react-hooks/exhaustive-deps

    // Scroll to top on step change
    useEffect(() => {
        if (contentRef.current) {
            contentRef.current.scrollTop = 0;
        }
    }, [currentStep]);

    const validateStep = (step) => {
        switch (step) {
            case 0:
                if (!data.orgName.trim()) {
                    setStepErrors({ 0: 'Organization name is required.' });
                    return false;
                }
                break;
            case 2:
                // Service is optional — no validation needed
                break;
            case 3:
                // Staff is optional — but validate emails if provided
                for (const staff of data.staffList) {
                    if (staff.email.trim() && !staff.email.includes('@')) {
                        setStepErrors({ 3: `Invalid email: ${staff.email}` });
                        return false;
                    }
                }
                break;
            default:
                break;
        }
        setStepErrors({});
        return true;
    };

    const handleNext = async () => {
        if (!validateStep(currentStep)) return;
        setError(null);

        // Step 0 → 1: Create organization + workspace
        if (currentStep === 0 && !orgCreated) {
            setSubmitting(true);
            try {
                const res = await organizationsApi.setup({
                    organization_name: data.orgName.trim(),
                    workspace_name: (data.wsName || data.orgName).trim(),
                    timezone: data.timezone,
                    currency: data.currency,
                });

                const resData = res.data?.data || res.data || {};
                const wsSlug = resData.workspace?.workspace_slug ||
                    (data.wsName || data.orgName).trim().toLowerCase().replace(/[^a-z0-9]/g, '-');
                setWorkspaceSlug(wsSlug);
                setOrgCreated(true);

                // Set active workspace in localStorage for API calls (needed for service/user creation)
                const wsId = resData.workspace?.ROWID || resData.workspace?.workspace_id;
                if (wsId) {
                    localStorage.setItem(STORAGE_KEYS.ACTIVE_WORKSPACE, String(wsId));
                }

                // Refresh auth + workspace contexts to pick up new state
                markSetupComplete();
                await refreshUser();
                await refreshWorkspaces();
            } catch (err) {
                const msg = err.data?.message || err.response?.data?.message || err.message || 'Failed to create organization.';
                setError(msg);
                setSubmitting(false);
                return;
            }
            setSubmitting(false);
        }

        // Step 2 → 3: Create service (if filled)
        if (currentStep === 2 && data.service.name.trim()) {
            setSubmitting(true);
            try {
                const hours = parseInt(data.service.durationHours) || 0;
                const minutes = parseInt(data.service.durationMinutes) || 0;
                await servicesApi.create({
                    name: data.service.name.trim(),
                    duration_minutes: hours * 60 + minutes || 30,
                    price: parseFloat(data.service.price) || 0,
                    service_type: data.service.type,
                    meeting_mode: data.service.meetingMode,
                    description: data.service.description,
                });
            } catch (err) {
                console.warn('Service creation during onboarding failed:', err.message || err);
                // Non-blocking — continue to next step
            }
            setSubmitting(false);
        }

        // Step 3 → 4: Add staff (if filled)
        if (currentStep === 3) {
            const validStaff = data.staffList.filter(s => s.email.trim());
            if (validStaff.length > 0) {
                setSubmitting(true);
                for (const staff of validStaff) {
                    try {
                        await usersApi.create({
                            name: staff.name.trim() || staff.email.split('@')[0],
                            email: staff.email.trim(),
                        });
                    } catch (err) {
                        console.warn(`Staff invite failed for ${staff.email}:`, err.message || err);
                        // Non-blocking — continue with others
                    }
                }
                setSubmitting(false);
            }
        }

        setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
    };

    const handleBack = () => {
        setError(null);
        setStepErrors({});
        setCurrentStep(prev => Math.max(prev - 1, 0));
    };

    const handleFinish = () => {
        // Mark onboarding done in localStorage
        localStorage.setItem('bp_onboarding_completed', 'true');
        // Navigate to dashboard
        const slug = workspaceSlug || data.orgName.toLowerCase().replace(/[^a-z0-9]/g, '-');
        window.location.hash = `#/ws/${slug}`;
        window.location.reload();
    };

    const canSkip = currentStep === 2 || currentStep === 3;
    const isLastStep = currentStep === STEPS.length - 1;
    const stepData = STEPS[currentStep];

    return (
        <div style={{
            display: 'flex', height: '100vh', fontFamily: "'Inter', -apple-system, sans-serif",
            backgroundColor: '#F9FAFB',
        }}>
            {/* ─── LEFT SIDEBAR: Progress ─── */}
            <div style={{
                width: '300px', backgroundColor: '#1E1B3A', color: 'white', padding: '40px 0',
                display: 'flex', flexDirection: 'column', flexShrink: 0,
            }}>
                <div style={{ padding: '0 32px', marginBottom: '48px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <CheckCircle2 size={24} color="#A78BFA" />
                        <span style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.01em' }}>Bookings+</span>
                    </div>
                    <p style={{ fontSize: '13px', color: '#9CA3AF', lineHeight: '1.5' }}>
                        Let's get your workspace ready in just a few steps.
                    </p>
                </div>

                <nav style={{ flex: 1, padding: '0 20px' }}>
                    {STEPS.map((step, idx) => {
                        const isActive = idx === currentStep;
                        const isCompleted = idx < currentStep;
                        const Icon = step.icon;
                        return (
                            <div
                                key={step.id}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '14px',
                                    padding: '14px 16px', borderRadius: '10px', marginBottom: '4px',
                                    backgroundColor: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                                    transition: 'all 0.2s',
                                    cursor: isCompleted ? 'pointer' : 'default',
                                    opacity: idx > currentStep ? 0.4 : 1,
                                }}
                                onClick={() => isCompleted && setCurrentStep(idx)}
                            >
                                <div style={{
                                    width: '36px', height: '36px', borderRadius: '10px',
                                    backgroundColor: isCompleted ? '#16A34A' : isActive ? '#5C44B5' : 'rgba(255,255,255,0.06)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0, transition: 'background-color 0.3s',
                                }}>
                                    {isCompleted ? (
                                        <CheckCircle2 size={18} color="white" />
                                    ) : (
                                        <Icon size={18} color={isActive ? 'white' : '#6B7280'} />
                                    )}
                                </div>
                                <div>
                                    <div style={{
                                        fontSize: '14px', fontWeight: isActive ? 600 : 500,
                                        color: isActive ? 'white' : isCompleted ? '#D1D5DB' : '#6B7280',
                                    }}>{step.label}</div>
                                    <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '1px' }}>
                                        {step.description}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </nav>

                <div style={{ padding: '0 32px', fontSize: '12px', color: '#4B5563' }}>
                    Step {currentStep + 1} of {STEPS.length}
                </div>
            </div>

            {/* ─── RIGHT: Content Area ─── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Top bar */}
                <div style={{
                    padding: '20px 48px', borderBottom: '1px solid #E5E7EB', backgroundColor: 'white',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
                }}>
                    <div>
                        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', margin: 0 }}>
                            {stepData.label}
                        </h1>
                        <p style={{ fontSize: '14px', color: '#6B7280', margin: '4px 0 0' }}>
                            {stepData.description}
                        </p>
                    </div>
                    <div style={{ fontSize: '13px', color: '#9CA3AF' }}>
                        Hi, {user?.name || user?.display_name || 'Admin'}!
                    </div>
                </div>

                {/* Scrollable content */}
                <div ref={contentRef} style={{
                    flex: 1, overflowY: 'auto', padding: '32px 48px',
                }}>
                    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
                        <ErrorBanner message={error || stepErrors[currentStep]} onDismiss={() => { setError(null); setStepErrors({}); }} />

                        {currentStep === 0 && <StepOrganization data={data} onChange={setData} error={stepErrors[0]} />}
                        {currentStep === 1 && <StepBusinessHours data={data} onChange={setData} />}
                        {currentStep === 2 && <StepService data={data} onChange={setData} />}
                        {currentStep === 3 && <StepStaff data={data} onChange={setData} />}
                        {currentStep === 4 && <StepComplete data={data} />}
                    </div>
                </div>

                {/* Bottom Action Bar */}
                <div style={{
                    padding: '16px 48px', borderTop: '1px solid #E5E7EB', backgroundColor: 'white',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
                }}>
                    <div>
                        {currentStep > 0 && !isLastStep && (
                            <button onClick={handleBack} disabled={submitting} style={{
                                ...btnSecondaryStyle, display: 'flex', alignItems: 'center', gap: '6px',
                                opacity: submitting ? 0.5 : 1,
                            }}>
                                <ChevronLeft size={16} /> Back
                            </button>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        {canSkip && !submitting && (
                            <button onClick={() => setCurrentStep(prev => prev + 1)} style={{
                                ...btnSecondaryStyle, color: '#6B7280',
                            }}>
                                Skip for now
                            </button>
                        )}
                        {isLastStep ? (
                            <button onClick={handleFinish} style={{
                                ...btnPrimaryStyle, padding: '12px 40px', fontSize: '15px',
                                display: 'flex', alignItems: 'center', gap: '8px',
                            }}>
                                Go to Dashboard <ArrowRight size={18} />
                            </button>
                        ) : (
                            <button onClick={handleNext} disabled={submitting} style={{
                                ...btnPrimaryStyle, padding: '12px 36px',
                                display: 'flex', alignItems: 'center', gap: '8px',
                                opacity: submitting ? 0.7 : 1, cursor: submitting ? 'not-allowed' : 'pointer',
                            }}>
                                {submitting && (
                                    <span style={{
                                        width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)',
                                        borderTopColor: 'white', borderRadius: '50%',
                                        animation: 'spin 0.7s linear infinite', display: 'inline-block',
                                    }} />
                                )}
                                {submitting ? 'Setting up...' : (
                                    <>{currentStep === 0 ? 'Create & Continue' : 'Continue'} <ChevronRight size={16} /></>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ─── Shared Styles ─── */

const labelStyle = {
    display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#374151',
};

const hintStyle = {
    fontSize: '12px', color: '#9CA3AF', marginTop: '4px', marginBottom: 0,
};

const inputStyle = {
    width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px',
    fontSize: '14px', fontFamily: 'inherit', outline: 'none', backgroundColor: 'white',
    transition: 'border-color 0.2s, box-shadow 0.2s', boxSizing: 'border-box',
    color: '#111827',
};

const tableInputStyle = {
    width: '100%', padding: '7px 10px', border: '1px solid #E5E7EB', borderRadius: '6px',
    fontSize: '13px', fontFamily: 'inherit', outline: 'none', backgroundColor: '#FAFAFA',
    transition: 'border-color 0.2s', boxSizing: 'border-box',
};

const tableHeaderStyle = {
    fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569',
};

const btnPrimaryStyle = {
    padding: '10px 28px', backgroundColor: '#5C44B5', color: 'white', border: 'none',
    borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    transition: 'background-color 0.2s', display: 'inline-flex', alignItems: 'center', gap: '6px',
};

const btnSecondaryStyle = {
    padding: '10px 20px', backgroundColor: 'white', color: '#374151', border: '1px solid #D1D5DB',
    borderRadius: '8px', fontSize: '14px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
    transition: 'all 0.15s',
};

export default Onboarding;
