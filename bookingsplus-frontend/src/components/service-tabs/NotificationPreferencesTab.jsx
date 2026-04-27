import React, { useState } from 'react';
import { Button } from '../../ui/Button';
import { Mail, MessageSquare, Calendar, BellRing } from 'lucide-react';

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

const DEFAULT_NOTIFICATIONS = {
    confirmationEmail: true,
    reminderEmail: true,
    reminderEmailHours: 24,
    cancellationEmail: true,
    rescheduleEmail: true,
    smsNotifications: false,
    smsReminderHours: 2,
    calendarInvite: true,
    staffNotification: true,
    adminNotification: false
};

const NotificationPreferencesTab = ({ service, onUpdate }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [prefs, setPrefs] = useState(service.notifications || DEFAULT_NOTIFICATIONS);

    const handleSave = () => {
        onUpdate({ ...service, notifications: prefs });
        setIsEditing(false);
    };

    const handleCancel = () => {
        setPrefs(service.notifications || DEFAULT_NOTIFICATIONS);
        setIsEditing(false);
    };

    const Section = ({ title, icon: Icon, children }) => (
        <div style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <Icon size={18} color="var(--pk-primary)" />
                <h4 style={{ fontSize: '14px', fontWeight: 600 }}>{title}</h4>
            </div>
            <div style={{ border: '1px solid var(--pk-border)', borderRadius: '8px', overflow: 'hidden' }}>
                {children}
            </div>
        </div>
    );

    const Row = ({ label, description, checked, onChange, extra }) => (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px', borderBottom: '1px solid #F3F4F6'
        }}>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 500 }}>{label}</div>
                {description && <div style={{ fontSize: '12px', color: 'var(--pk-text-muted)', marginTop: '2px' }}>{description}</div>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {extra}
                <ToggleSwitch checked={checked} disabled={!isEditing} onChange={onChange} />
            </div>
        </div>
    );

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Notification Preferences</h3>
                {isEditing ? (
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <Button variant="primary" onClick={handleSave}>Save</Button>
                        <Button variant="secondary" onClick={handleCancel}>Cancel</Button>
                    </div>
                ) : (
                    <Button variant="secondary" onClick={() => setIsEditing(true)}>✏️ Edit</Button>
                )}
            </div>

            <Section title="Email Notifications" icon={Mail}>
                <Row label="Booking Confirmation" description="Send confirmation email when a booking is made"
                    checked={prefs.confirmationEmail} onChange={() => setPrefs({ ...prefs, confirmationEmail: !prefs.confirmationEmail })} />
                <Row label="Booking Reminder" description={`Send reminder ${prefs.reminderEmailHours}h before appointment`}
                    checked={prefs.reminderEmail} onChange={() => setPrefs({ ...prefs, reminderEmail: !prefs.reminderEmail })}
                    extra={prefs.reminderEmail && (
                        <input className="input" type="number" value={prefs.reminderEmailHours}
                            disabled={!isEditing} style={{ width: '70px', padding: '4px 8px', fontSize: '13px' }}
                            onChange={e => setPrefs({ ...prefs, reminderEmailHours: parseInt(e.target.value) || 0 })} />
                    )} />
                <Row label="Cancellation Notice" description="Send email when a booking is cancelled"
                    checked={prefs.cancellationEmail} onChange={() => setPrefs({ ...prefs, cancellationEmail: !prefs.cancellationEmail })} />
                <Row label="Reschedule Notice" description="Send email when a booking is rescheduled"
                    checked={prefs.rescheduleEmail} onChange={() => setPrefs({ ...prefs, rescheduleEmail: !prefs.rescheduleEmail })} />
            </Section>

            <Section title="SMS Notifications" icon={MessageSquare}>
                <Row label="SMS Notifications" description="Send SMS notifications for bookings"
                    checked={prefs.smsNotifications} onChange={() => setPrefs({ ...prefs, smsNotifications: !prefs.smsNotifications })} />
                <Row label="SMS Reminder" description={`Send SMS reminder ${prefs.smsReminderHours}h before`}
                    checked={prefs.smsNotifications && prefs.smsReminderHours > 0}
                    onChange={() => setPrefs({ ...prefs, smsReminderHours: prefs.smsReminderHours > 0 ? 0 : 2 })}
                    extra={prefs.smsNotifications && (
                        <input className="input" type="number" value={prefs.smsReminderHours}
                            disabled={!isEditing} style={{ width: '70px', padding: '4px 8px', fontSize: '13px' }}
                            onChange={e => setPrefs({ ...prefs, smsReminderHours: parseInt(e.target.value) || 0 })} />
                    )} />
            </Section>

            <Section title="Calendar" icon={Calendar}>
                <Row label="Calendar Invite" description="Automatically send calendar invites with booking confirmation"
                    checked={prefs.calendarInvite} onChange={() => setPrefs({ ...prefs, calendarInvite: !prefs.calendarInvite })} />
            </Section>

            <Section title="Staff & Admin" icon={BellRing}>
                <Row label="Staff Notification" description="Notify assigned staff about new bookings"
                    checked={prefs.staffNotification} onChange={() => setPrefs({ ...prefs, staffNotification: !prefs.staffNotification })} />
                <Row label="Admin Notification" description="Notify admins about all booking activities"
                    checked={prefs.adminNotification} onChange={() => setPrefs({ ...prefs, adminNotification: !prefs.adminNotification })} />
            </Section>
        </div>
    );
};

export default NotificationPreferencesTab;
