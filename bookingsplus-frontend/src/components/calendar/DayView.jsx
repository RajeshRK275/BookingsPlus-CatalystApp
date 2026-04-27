import React from 'react';
import { isSameDay } from 'date-fns';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const getInitials = (name) => name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : 'SV';

const DayView = ({ date, staff, appointments, onSlotClick }) => {
    // Filter appointments for the current day
    const dayAppointments = appointments.filter(apt => isSameDay(new Date(apt.start_time), date));

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Headers */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--pk-border)', paddingRight: '12px' }}>
                <div style={{ width: '60px', flexShrink: 0, padding: '16px 8px', textAlign: 'center', borderRight: '1px solid var(--pk-border)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--pk-text-muted)', fontWeight: 500 }}>IST<br/>(+05:30)</div>
                </div>
                {staff.map((s, index) => (
                    <div key={s.id} style={{ flex: 1, padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', borderRight: index < staff.length - 1 ? '1px solid var(--pk-border)' : 'none' }}>
                        <div style={{
                            width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#E5E7EB',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, color: '#6B7280'
                        }}>{getInitials(s.name)}</div>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--pk-text-main)' }}>{s.name}</span>
                    </div>
                ))}
            </div>

            {/* Grid */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex' }}>
                {/* Time labels */}
                <div style={{ width: '60px', flexShrink: 0, borderRight: '1px solid var(--pk-border)' }}>
                    {HOURS.map(h => (
                        <div key={h} style={{ height: '60px', display: 'flex', justifyContent: 'flex-end', paddingRight: '8px', paddingTop: '8px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--pk-text-muted)' }}>
                                {h === 0 ? '12:00 am' : h < 12 ? `${h.toString().padStart(2, '0')}:00 am` : h === 12 ? '12:00 pm' : `${(h - 12).toString().padStart(2, '0')}:00 pm`}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Staff columns */}
                {staff.map((s, index) => {
                    const staffApts = dayAppointments.filter(apt => apt.staff_name === s.name);

                    return (
                        <div key={s.id} style={{ flex: 1, position: 'relative', borderRight: index < staff.length - 1 ? '1px solid var(--pk-border)' : 'none', backgroundImage: 'repeating-linear-gradient(#f3f4f6 0 1px, transparent 1px 100%)', backgroundSize: '100% 60px', backgroundColor: '#fdfdfd' }}>
                            {/* Slits for clicking */}
                            {HOURS.map(h => (
                                <div key={h} 
                                    onClick={() => onSlotClick({ date, time: `${h.toString().padStart(2, '0')}:00`, staffId: s.id, staffName: s.name })}
                                    style={{ height: '60px', width: '100%', cursor: 'pointer', borderBottom: '1px dashed #e5e7eb' }}
                                />
                            ))}

                            {/* Render Appointments */}
                            {staffApts.map(apt => {
                                const start = new Date(apt.start_time);
                                const end = apt.end_time ? new Date(apt.end_time) : new Date(start.getTime() + 60 * 60000);
                                const top = (start.getHours() * 60) + start.getMinutes();
                                let duration = (end.getTime() - start.getTime()) / 60000;
                                if (isNaN(duration) || duration <= 0) duration = 60;
                                
                                return (
                                    <div key={apt.id} style={{
                                        position: 'absolute', top: `${top}px`, height: `${duration}px`,
                                        left: '4px', right: '4px', backgroundColor: '#C4B5FD', borderRadius: '4px',
                                        padding: '4px 8px', overflow: 'hidden', borderLeft: '3px solid #7C3AED',
                                        color: '#4C1D95', fontSize: '12px', zIndex: 10
                                    }}>
                                        <div style={{ fontWeight: 600 }}>{apt.customer_name}</div>
                                        <div style={{ fontSize: '11px', opacity: 0.8 }}>{apt.service_name}</div>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default DayView;
