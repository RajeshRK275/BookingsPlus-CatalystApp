import React, { useState } from 'react';
import { Button } from '../../ui/Button';

const ToggleSwitch = ({ checked, onChange, disabled }) => (
    <div onClick={disabled ? undefined : onChange} style={{
        width: '44px', height: '24px', borderRadius: '12px',
        cursor: disabled ? 'default' : 'pointer',
        backgroundColor: checked ? 'var(--pk-primary)' : '#D1D5DB',
        position: 'relative', transition: 'background-color 0.2s',
        opacity: disabled ? 0.6 : 1
    }}>
        <div style={{
            width: '20px', height: '20px', borderRadius: '50%', backgroundColor: 'white',
            position: 'absolute', top: '2px', left: checked ? '22px' : '2px',
            transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
        }} />
    </div>
);

const DEFAULT_RULES = {
    bufferBefore: 0,
    bufferAfter: 15,
    slotInterval: 30,
    allowCancellation: true,
    cancellationPeriodHours: 24,
    allowRescheduling: true,
    reschedulePeriodHours: 12,
    autoConfirm: true,
    requireApproval: false
};

const SchedulingRulesTab = ({ service, onUpdate }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [rules, setRules] = useState(service.schedulingRules || DEFAULT_RULES);

    const handleSave = () => {
        onUpdate({ ...service, schedulingRules: rules });
        setIsEditing(false);
    };

    const handleCancel = () => {
        setRules(service.schedulingRules || DEFAULT_RULES);
        setIsEditing(false);
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Scheduling Rules</h3>
                {isEditing ? (
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <Button variant="primary" onClick={handleSave}>Save</Button>
                        <Button variant="secondary" onClick={handleCancel}>Cancel</Button>
                    </div>
                ) : (
                    <Button variant="secondary" onClick={() => setIsEditing(true)}>✏️ Edit</Button>
                )}
            </div>

            {/* Buffers & Intervals */}
            <div style={{ marginBottom: '32px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px' }}>Buffers & Intervals</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                    <div className="form-group">
                        <label>Buffer before (mins)</label>
                        <input className="input" type="number" value={rules.bufferBefore} disabled={!isEditing}
                            onChange={e => setRules({ ...rules, bufferBefore: parseInt(e.target.value) || 0 })} />
                    </div>
                    <div className="form-group">
                        <label>Buffer after (mins)</label>
                        <input className="input" type="number" value={rules.bufferAfter} disabled={!isEditing}
                            onChange={e => setRules({ ...rules, bufferAfter: parseInt(e.target.value) || 0 })} />
                    </div>
                    <div className="form-group">
                        <label>Slot interval (mins)</label>
                        <input className="input" type="number" value={rules.slotInterval} disabled={!isEditing}
                            onChange={e => setRules({ ...rules, slotInterval: parseInt(e.target.value) || 0 })} />
                    </div>
                </div>
            </div>

            {/* Policies */}
            <div style={{ marginBottom: '32px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px' }}>Policies</h4>
                <div style={{
                    border: '1px solid var(--pk-border)', borderRadius: '8px', overflow: 'hidden'
                }}>
                    {/* Cancellation */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #F3F4F6' }}>
                        <div>
                            <div style={{ fontSize: '14px', fontWeight: 500 }}>Allow Cancellation</div>
                            <div style={{ fontSize: '12px', color: 'var(--pk-text-muted)', marginTop: '2px' }}>
                                Customers can cancel up to {rules.cancellationPeriodHours}h before the appointment
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {rules.allowCancellation && (
                                <input className="input" type="number" value={rules.cancellationPeriodHours}
                                    disabled={!isEditing} style={{ width: '80px', padding: '6px 8px' }}
                                    onChange={e => setRules({ ...rules, cancellationPeriodHours: parseInt(e.target.value) || 0 })} />
                            )}
                            <ToggleSwitch checked={rules.allowCancellation} disabled={!isEditing}
                                onChange={() => setRules({ ...rules, allowCancellation: !rules.allowCancellation })} />
                        </div>
                    </div>

                    {/* Rescheduling */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #F3F4F6' }}>
                        <div>
                            <div style={{ fontSize: '14px', fontWeight: 500 }}>Allow Rescheduling</div>
                            <div style={{ fontSize: '12px', color: 'var(--pk-text-muted)', marginTop: '2px' }}>
                                Customers can reschedule up to {rules.reschedulePeriodHours}h before
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {rules.allowRescheduling && (
                                <input className="input" type="number" value={rules.reschedulePeriodHours}
                                    disabled={!isEditing} style={{ width: '80px', padding: '6px 8px' }}
                                    onChange={e => setRules({ ...rules, reschedulePeriodHours: parseInt(e.target.value) || 0 })} />
                            )}
                            <ToggleSwitch checked={rules.allowRescheduling} disabled={!isEditing}
                                onChange={() => setRules({ ...rules, allowRescheduling: !rules.allowRescheduling })} />
                        </div>
                    </div>

                    {/* Auto-confirm */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #F3F4F6' }}>
                        <div>
                            <div style={{ fontSize: '14px', fontWeight: 500 }}>Auto-confirm bookings</div>
                            <div style={{ fontSize: '12px', color: 'var(--pk-text-muted)', marginTop: '2px' }}>Automatically confirm bookings without approval</div>
                        </div>
                        <ToggleSwitch checked={rules.autoConfirm} disabled={!isEditing}
                            onChange={() => setRules({ ...rules, autoConfirm: !rules.autoConfirm })} />
                    </div>

                    {/* Require Approval */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
                        <div>
                            <div style={{ fontSize: '14px', fontWeight: 500 }}>Require Admin Approval</div>
                            <div style={{ fontSize: '12px', color: 'var(--pk-text-muted)', marginTop: '2px' }}>Bookings need approval before being confirmed</div>
                        </div>
                        <ToggleSwitch checked={rules.requireApproval} disabled={!isEditing}
                            onChange={() => setRules({ ...rules, requireApproval: !rules.requireApproval })} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SchedulingRulesTab;
