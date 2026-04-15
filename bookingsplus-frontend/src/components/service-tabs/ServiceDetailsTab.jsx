import React, { useState } from 'react';
import { Button } from '../../ui/Button';

const ToggleGroup = ({ options, value, onChange }) => (
    <div style={{ display: 'flex', borderRadius: '6px', border: '1px solid var(--pk-border)', overflow: 'hidden' }}>
        {options.map(opt => (
            <div
                key={opt}
                onClick={() => onChange(opt)}
                style={{
                    padding: '8px 20px', cursor: 'pointer', fontSize: '14px',
                    backgroundColor: value === opt ? '#F3F0FF' : 'white',
                    color: value === opt ? 'var(--pk-primary)' : 'var(--pk-text-muted)',
                    borderRight: '1px solid var(--pk-border)',
                    fontWeight: value === opt ? 500 : 400,
                    transition: 'all 0.15s'
                }}
            >{opt}</div>
        ))}
    </div>
);

const ServiceDetailsTab = ({ service, onUpdate }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [form, setForm] = useState({ ...service });

    const handleSave = () => {
        onUpdate(form);
        setIsEditing(false);
    };

    const handleCancel = () => {
        setForm({ ...service });
        setIsEditing(false);
    };

    const getInitials = (name) => name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : 'SV';

    if (isEditing) {
        return (
            <div>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{
                            width: '48px', height: '48px', borderRadius: '10px',
                            backgroundColor: '#C4B5FD', color: 'white',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '16px', fontWeight: 600
                        }}>{getInitials(form.name)}</div>
                        <span style={{ fontSize: '16px', fontWeight: 500 }}>{form.name}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <Button variant="primary" onClick={handleSave} style={{ padding: '8px 24px' }}>Save</Button>
                        <Button variant="secondary" onClick={handleCancel} style={{ padding: '8px 24px' }}>Cancel</Button>
                    </div>
                </div>

                {/* Edit Form */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    <div className="form-group">
                        <label>Event Type Name *</label>
                        <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label>Duration</label>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <select className="input" value={`${Math.floor((form.duration || 60) / 60)} Hours`}
                                onChange={e => setForm({ ...form, duration: parseInt(e.target.value) * 60 + ((form.duration || 0) % 60) })}>
                                {[0, 1, 2, 3, 4, 5].map(h => <option key={h} value={`${h} Hours`}>{h} Hours</option>)}
                            </select>
                            <select className="input" value={`${(form.duration || 0) % 60} Minutes`}
                                onChange={e => setForm({ ...form, duration: Math.floor((form.duration || 0) / 60) * 60 + parseInt(e.target.value) })}>
                                {[0, 15, 30, 45].map(m => <option key={m} value={`${m} Minutes`}>{m} Minutes</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Price</label>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <ToggleGroup options={['Paid', 'Free']} value={form.priceType || 'Free'} onChange={v => setForm({ ...form, priceType: v })} />
                            {form.priceType === 'Paid' && (
                                <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                                    <div style={{ padding: '8px 12px', background: '#F9FAFB', border: '1px solid var(--pk-border)', borderRadius: '4px 0 0 4px', color: 'var(--pk-text-muted)' }}>$</div>
                                    <input className="input" style={{ borderRadius: '0 4px 4px 0', borderLeft: 'none' }} value={form.priceValue || '0'} onChange={e => setForm({ ...form, priceValue: e.target.value })} />
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Meeting Mode</label>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <ToggleGroup options={['Online', 'Offline']} value={form.meetingMode || 'Online'} onChange={v => setForm({ ...form, meetingMode: v })} />
                            <select className="input" style={{ flex: 1 }} value={form.meetingLocation || ''} onChange={e => setForm({ ...form, meetingLocation: e.target.value })}>
                                {(form.meetingMode === 'Online' || !form.meetingMode) ?
                                    <option value="Zoho Meeting">Zoho Meeting</option> :
                                    <option value="None">None</option>}
                            </select>
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Visibility</label>
                        <ToggleGroup options={['Public', 'Private']} value={form.visibility || 'Public'} onChange={v => setForm({ ...form, visibility: v })} />
                    </div>
                    <div className="form-group">
                        <label>Status</label>
                        <ToggleGroup options={['Active', 'Inactive']} value={form.status === 'active' ? 'Active' : 'Inactive'} onChange={v => setForm({ ...form, status: v.toLowerCase() })} />
                    </div>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label>Description</label>
                        <textarea className="input" rows={4} value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })}
                            style={{ resize: 'vertical', minHeight: '100px' }} />
                    </div>
                </div>
            </div>
        );
    }

    // View mode
    const formatDuration = (mins) => {
        if (!mins) return '-';
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        if (h && m) return `${h} Hour${h > 1 ? 's' : ''} ${m} mins`;
        if (h) return `${h} Hour${h > 1 ? 's' : ''}`;
        return `${m} mins`;
    };

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                        width: '48px', height: '48px', borderRadius: '10px',
                        backgroundColor: '#C4B5FD', color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '16px', fontWeight: 600
                    }}>{getInitials(service.name)}</div>
                    <span style={{ fontSize: '16px', fontWeight: 500 }}>{service.name}</span>
                </div>
                <Button variant="secondary" onClick={() => setIsEditing(true)} style={{ padding: '8px 24px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    ✏️ Edit
                </Button>
            </div>

            {/* Read-only Fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px 48px' }}>
                <div>
                    <div style={{ fontSize: '13px', color: 'var(--pk-primary)', marginBottom: '4px' }}>Event Type Name</div>
                    <div style={{ fontSize: '14px', fontWeight: 500 }}>{service.name}</div>
                </div>
                <div>
                    <div style={{ fontSize: '13px', color: 'var(--pk-primary)', marginBottom: '4px' }}>Duration</div>
                    <div style={{ fontSize: '14px', fontWeight: 500 }}>{formatDuration(service.duration)}</div>
                </div>
                <div>
                    <div style={{ fontSize: '13px', color: 'var(--pk-primary)', marginBottom: '4px' }}>Price</div>
                    <div style={{ fontSize: '14px', fontWeight: 500 }}>{service.price || 'Free'}</div>
                </div>
                <div>
                    <div style={{ fontSize: '13px', color: 'var(--pk-primary)', marginBottom: '4px' }}>Meeting Mode</div>
                    <div style={{ fontSize: '14px', fontWeight: 500 }}>{service.meetingMode || '-'}</div>
                </div>
                <div>
                    <div style={{ fontSize: '13px', color: 'var(--pk-primary)', marginBottom: '4px' }}>Visibility</div>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--pk-primary)' }}>{service.visibility || 'Public'}</div>
                </div>
                <div>
                    <div style={{ fontSize: '13px', color: 'var(--pk-primary)', marginBottom: '4px' }}>Status</div>
                    <span className={`status-badge status-${service.status}`}>
                        {(service.status || 'active').charAt(0).toUpperCase() + (service.status || 'active').slice(1)}
                    </span>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: '13px', color: 'var(--pk-primary)', marginBottom: '4px' }}>Description</div>
                    <div style={{ fontSize: '14px' }}>{service.description || '-'}</div>
                </div>
            </div>
        </div>
    );
};

export default ServiceDetailsTab;
