import React from 'react';
import { startOfWeek, addDays, format, isSameDay } from 'date-fns';

const getInitials = (name) => name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : 'SV';

const WeekView = ({ date, staff, appointments, onSlotClick }) => {
    const weekStart = startOfWeek(date);
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Headers */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--pk-border)', paddingRight: '12px' }}>
                <div style={{ width: '120px', flexShrink: 0, padding: '12px', borderRight: '1px solid var(--pk-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontSize: '11px', color: 'var(--pk-text-muted)', fontWeight: 500, textAlign: 'center' }}>IST<br/>(+05:30)</div>
                </div>
                {days.map((d, index) => (
                    <div key={index} style={{ flex: 1, padding: '12px', textAlign: 'center', borderRight: index < days.length - 1 ? '1px solid var(--pk-border)' : 'none' }}>
                        <div style={{ fontSize: '13px', color: 'var(--pk-text-main)', marginBottom: '4px' }}>{format(d, 'EEEE')}</div>
                        <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--pk-text-main)' }}>{format(d, 'dd')}</div>
                    </div>
                ))}
            </div>

            {/* Grid */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                {staff.map((s, index) => (
                    <div key={s.id} style={{ display: 'flex', flex: 1, minHeight: '120px', borderBottom: index < staff.length - 1 ? '1px solid var(--pk-border)' : 'none' }}>
                        {/* Staff Left Header */}
                        <div style={{ width: '120px', flexShrink: 0, padding: '16px', borderRight: '1px solid var(--pk-border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#E5E7EB', marginBottom: '8px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 600, color: '#6B7280'
                            }}>{getInitials(s.name)}</div>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--pk-text-main)', textAlign: 'center' }}>{s.name}</span>
                            <span style={{ fontSize: '11px', color: 'var(--pk-text-muted)' }}>Staff</span>
                        </div>

                        {/* Days Grid */}
                        <div style={{ display: 'flex', flex: 1 }}>
                            {days.map((d, dIndex) => {
                                const dayStaffApts = appointments.filter(apt => apt.staff_name === s.name && isSameDay(new Date(apt.start_time), d));
                                
                                return (
                                    <div key={dIndex} 
                                        onClick={() => onSlotClick({ date: d, time: '10:00', staffId: s.id, staffName: s.name })}
                                        style={{ 
                                            flex: 1, borderRight: dIndex < days.length - 1 ? '1px solid var(--pk-border)' : 'none', 
                                            padding: '8px', cursor: 'pointer', position: 'relative',
                                            transition: 'background-color 0.15s'
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#FAFAFA'; e.currentTarget.style.backgroundImage = 'radial-gradient(circle, #EF4444 2px, transparent 2px)'; e.currentTarget.style.backgroundSize = '100% 20px'; e.currentTarget.style.backgroundPosition = '0 center'; e.currentTarget.style.backgroundRepeat = 'no-repeat'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.backgroundImage = 'none'; }}
                                    >
                                        {/* Appointments */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            {dayStaffApts.map(apt => (
                                                <div key={apt.id} style={{
                                                    backgroundColor: '#DCFCE7', color: '#166534', padding: '4px 8px', borderRadius: '4px',
                                                    fontSize: '11px', borderLeft: '2px solid #22C55E', fontWeight: 500,
                                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                                }}>
                                                    {format(new Date(apt.start_time), 'HH:mm')} - {apt.customer_name}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default WeekView;
