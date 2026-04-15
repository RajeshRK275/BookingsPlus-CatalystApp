import React from 'react';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, format, isSameMonth, isSameDay } from 'date-fns';

const getInitials = (name) => name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : 'SV';

const MonthView = ({ date, staff, appointments, onSlotClick }) => {
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const days = [];
    let day = startDate;
    while (day <= endDate) {
        days.push(day);
        day = addDays(day, 1);
    }

    const weekDays = Array.from({ length: 7 }, (_, i) => format(addDays(startDate, i), 'EEEE'));

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--pk-border)' }}>
                {weekDays.map(d => (
                    <div key={d} style={{ padding: '12px', textAlign: 'center', fontSize: '13px', fontWeight: 600, color: 'var(--pk-text-muted)', borderRight: '1px solid var(--pk-border)' }}>
                        {d}
                    </div>
                ))}
            </div>

            {/* Grid */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: '1fr', overflowY: 'auto' }}>
                {days.map((d, index) => {
                    const isCurrentMonth = isSameMonth(d, monthStart);
                    const isToday = isSameDay(d, new Date());
                    
                    // Group appointments for this day by staff name
                    const dayApts = appointments.filter(apt => isSameDay(new Date(apt.start_time), d));
                    
                    // Unique staff members who have appointments today
                    const activeStaffNames = [...new Set(dayApts.map(apt => apt.staff_name))].filter(Boolean);
                    
                    return (
                        <div key={index} 
                            onClick={() => onSlotClick({ date: d, time: '10:00', staffId: staff[0]?.id, staffName: staff[0]?.name })}
                            style={{ 
                                borderRight: '1px solid var(--pk-border)', borderBottom: '1px solid var(--pk-border)',
                                padding: '8px', cursor: 'pointer', backgroundColor: isCurrentMonth ? 'white' : '#F9FAFB',
                                transition: 'background-color 0.1s', display: 'flex', flexDirection: 'column'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isCurrentMonth ? '#F3F4F6' : '#F3F4F6'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isCurrentMonth ? 'white' : '#F9FAFB'; }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ 
                                    fontSize: '14px', fontWeight: isToday ? 600 : 500, 
                                    color: isToday ? 'white' : (isCurrentMonth ? 'var(--pk-text-main)' : '#9CA3AF'),
                                    backgroundColor: isToday ? 'var(--pk-primary)' : 'transparent',
                                    width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%'
                                }}>{format(d, 'd')}</span>
                            </div>

                            {/* Impressive UX: Render staff avatar bubbles */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', flex: 1, alignContent: 'flex-start' }}>
                                {activeStaffNames.map(staffName => {
                                    const staffCount = dayApts.filter(a => a.staff_name === staffName).length;
                                    return (
                                        <div key={staffName} title={`${staffName}: ${staffCount} appointments`} style={{
                                            width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#E0E7FF',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', 
                                            fontWeight: 600, color: '#3730A3', border: '1px solid #C7D2FE'
                                        }}>
                                            {getInitials(staffName)}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default MonthView;
