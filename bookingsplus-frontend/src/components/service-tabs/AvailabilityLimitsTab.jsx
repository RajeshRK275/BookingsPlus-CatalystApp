import React, { useState } from 'react';
import { Button } from '../../ui/Button';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const DEFAULT_AVAILABILITY = DAYS.map(day => ({
    day,
    enabled: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(day),
    startTime: '09:00',
    endTime: '17:00'
}));

const ToggleSwitch = ({ checked, onChange }) => (
    <div onClick={onChange} style={{
        width: '44px', height: '24px', borderRadius: '12px', cursor: 'pointer',
        backgroundColor: checked ? 'var(--pk-primary)' : '#D1D5DB',
        position: 'relative', transition: 'background-color 0.2s'
    }}>
        <div style={{
            width: '20px', height: '20px', borderRadius: '50%', backgroundColor: 'white',
            position: 'absolute', top: '2px', left: checked ? '22px' : '2px',
            transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
        }} />
    </div>
);

const AvailabilityLimitsTab = ({ service, onUpdate }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [availability, setAvailability] = useState(service.availability || DEFAULT_AVAILABILITY);
    const [limits, setLimits] = useState(service.limits || {
        maxBookingsPerDay: 10,
        maxBookingsPerSlot: 1,
        advanceBookingDays: 60,
        minimumNoticeHours: 1
    });

    const handleSave = () => {
        onUpdate({ ...service, availability, limits });
        setIsEditing(false);
    };

    const handleCancel = () => {
        setAvailability(service.availability || DEFAULT_AVAILABILITY);
        setLimits(service.limits || { maxBookingsPerDay: 10, maxBookingsPerSlot: 1, advanceBookingDays: 60, minimumNoticeHours: 1 });
        setIsEditing(false);
    };

    const updateDay = (index, field, value) => {
        const updated = [...availability];
        updated[index] = { ...updated[index], [field]: value };
        setAvailability(updated);
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Availability and Limits</h3>
                {isEditing ? (
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <Button variant="primary" onClick={handleSave}>Save</Button>
                        <Button variant="secondary" onClick={handleCancel}>Cancel</Button>
                    </div>
                ) : (
                    <Button variant="secondary" onClick={() => setIsEditing(true)}>✏️ Edit</Button>
                )}
            </div>

            {/* Working Hours */}
            <div style={{ marginBottom: '32px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', color: 'var(--pk-text-main)' }}>Working Hours</h4>
                <div style={{ border: '1px solid var(--pk-border)', borderRadius: '8px', overflow: 'hidden' }}>
                    {availability.map((slot, index) => (
                        <div key={slot.day} style={{
                            display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 20px',
                            borderBottom: index < availability.length - 1 ? '1px solid #F3F4F6' : 'none',
                            opacity: slot.enabled ? 1 : 0.5
                        }}>
                            <ToggleSwitch
                                checked={slot.enabled}
                                onChange={isEditing ? () => updateDay(index, 'enabled', !slot.enabled) : undefined}
                            />
                            <span style={{ width: '100px', fontSize: '14px', fontWeight: 500 }}>{slot.day}</span>
                            {slot.enabled ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input type="time" className="input" value={slot.startTime}
                                        disabled={!isEditing}
                                        onChange={e => updateDay(index, 'startTime', e.target.value)}
                                        style={{ width: '130px', padding: '6px 10px' }} />
                                    <span style={{ color: 'var(--pk-text-muted)' }}>to</span>
                                    <input type="time" className="input" value={slot.endTime}
                                        disabled={!isEditing}
                                        onChange={e => updateDay(index, 'endTime', e.target.value)}
                                        style={{ width: '130px', padding: '6px 10px' }} />
                                </div>
                            ) : (
                                <span style={{ fontSize: '13px', color: 'var(--pk-text-muted)' }}>Unavailable</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Booking Limits */}
            <div>
                <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', color: 'var(--pk-text-main)' }}>Booking Limits</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    {[
                        { label: 'Max bookings per day', key: 'maxBookingsPerDay' },
                        { label: 'Max bookings per slot', key: 'maxBookingsPerSlot' },
                        { label: 'Advance booking (days)', key: 'advanceBookingDays' },
                        { label: 'Minimum notice (hours)', key: 'minimumNoticeHours' }
                    ].map(({ label, key }) => (
                        <div key={key} className="form-group">
                            <label style={{ fontSize: '13px' }}>{label}</label>
                            <input className="input" type="number" value={limits[key]}
                                disabled={!isEditing}
                                onChange={e => setLimits({ ...limits, [key]: parseInt(e.target.value) || 0 })} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AvailabilityLimitsTab;
