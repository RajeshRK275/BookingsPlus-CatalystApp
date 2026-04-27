import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import DayView from '../components/calendar/DayView';
import WeekView from '../components/calendar/WeekView';
import MonthView from '../components/calendar/MonthView';
import AddAppointmentModal from '../components/calendar/AddAppointmentModal';
import { format, addDays, subDays, startOfWeek, endOfWeek, addWeeks, subWeeks, addMonths, subMonths } from 'date-fns';
import { appointmentsApi, usersApi } from '../services';

const CalendarPage = () => {
    const { user } = useAuth();
    const [activeView, setActiveView] = useState('Day');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [appointments, setAppointments] = useState([]);
    const [staffList, setStaffList] = useState([]);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState(null); // { date, time, staffId }

    useEffect(() => {
        const fetchData = async () => {
            const [aptRes, empRes] = await Promise.allSettled([
                appointmentsApi.getAll(),
                usersApi.getAll(),
            ]);
            if (aptRes.status === 'fulfilled' && aptRes.value.data?.success) {
                setAppointments(aptRes.value.data.data || []);
            }
            if (empRes.status === 'fulfilled' && empRes.value.data?.success) {
                setStaffList((empRes.value.data.data || []).map(e => ({
                    id: e.id || e.user_id || e.ROWID,
                    name: e.name || e.display_name || 'Unknown',
                })));
            }
        };
        fetchData();
    }, []);

    // Filter staff based on role. Admins see all staff; non-admins see only themselves.
    const displayStaff = useMemo(() => {
        if (staffList.length === 0) return [{ id: 0, name: user?.name || 'My Calendar' }];
        if (user?.is_super_admin || user?.role === 'Admin' || user?.role === 'Super Admin') {
            return staffList;
        }
        const myEntry = staffList.find(s => s.name === user?.name);
        return myEntry ? [myEntry] : [{ id: 0, name: user?.name || 'My Calendar' }];
    }, [user, staffList]);

    const handlePrev = () => {
        if (activeView === 'Day') setCurrentDate(subDays(currentDate, 1));
        if (activeView === 'Week') setCurrentDate(subWeeks(currentDate, 1));
        if (activeView === 'Month') setCurrentDate(subMonths(currentDate, 1));
    };

    const handleNext = () => {
        if (activeView === 'Day') setCurrentDate(addDays(currentDate, 1));
        if (activeView === 'Week') setCurrentDate(addWeeks(currentDate, 1));
        if (activeView === 'Month') setCurrentDate(addMonths(currentDate, 1));
    };

    const handleToday = () => {
        setCurrentDate(new Date());
    };

    const getDateTitle = () => {
        if (activeView === 'Day') return format(currentDate, 'dd-MMM-yyyy');
        if (activeView === 'Week') {
            const start = startOfWeek(currentDate);
            const end = endOfWeek(currentDate);
            if (start.getMonth() === end.getMonth()) {
                return `${format(start, 'dd')} - ${format(end, 'dd MMM yyyy')}`;
            }
            return `${format(start, 'dd MMM')} - ${format(end, 'dd MMM yyyy')}`;
        }
        if (activeView === 'Month') return format(currentDate, 'MMMM yyyy');
        return '';
    };

    const handleSlotClick = (slotDetails) => {
        setSelectedSlot(slotDetails);
        setIsAddModalOpen(true);
    };

    const handleAppointmentAdded = (newApt) => {
        const updated = [...appointments, newApt];
        setAppointments(updated);
    };

    return (
        <div style={{ height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column', backgroundColor: 'white' }}>
            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '1px solid var(--pk-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button onClick={handleToday} style={{
                        padding: '6px 16px', backgroundColor: 'white', border: '1px solid var(--pk-border)',
                        borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 500, color: 'var(--pk-text-main)'
                    }}>Today</button>

                    <div style={{ display: 'flex', border: '1px solid var(--pk-border)', borderRadius: '6px', overflow: 'hidden' }}>
                        {['Day', 'Week', 'Month'].map(view => (
                            <button key={view} onClick={() => setActiveView(view)} style={{
                                padding: '6px 16px', border: 'none', borderRight: view !== 'Month' ? '1px solid var(--pk-border)' : 'none',
                                cursor: 'pointer', fontSize: '13px', fontWeight: 500,
                                backgroundColor: activeView === view ? '#F3F0FF' : 'white',
                                color: activeView === view ? 'var(--pk-primary)' : 'var(--pk-text-main)'
                            }}>{view}</button>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button onClick={handlePrev} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><ChevronLeft size={20} color="var(--pk-text-main)" /></button>
                    <span style={{ fontSize: '16px', fontWeight: 600, minWidth: '160px', textAlign: 'center' }}>{getDateTitle()}</span>
                    <button onClick={handleNext} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><ChevronRight size={20} color="var(--pk-text-main)" /></button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button style={{
                        padding: '6px 16px', backgroundColor: 'white', border: '1px solid var(--pk-border)',
                        borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 500, color: 'var(--pk-primary)'
                    }}>Manage Calendars</button>
                    <button style={{
                        padding: '6px', backgroundColor: 'white', border: '1px solid var(--pk-border)',
                        borderRadius: '6px', cursor: 'pointer', display: 'flex'
                    }}><Settings size={18} color="var(--pk-text-muted)" /></button>
                </div>
            </div>

            {/* Calendar Main Body */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {activeView === 'Day' && <DayView date={currentDate} staff={displayStaff} appointments={appointments} onSlotClick={handleSlotClick} />}
                {activeView === 'Week' && <WeekView date={currentDate} staff={displayStaff} appointments={appointments} onSlotClick={handleSlotClick} />}
                {activeView === 'Month' && <MonthView date={currentDate} staff={displayStaff} appointments={appointments} onSlotClick={handleSlotClick} />}
            </div>

            {isAddModalOpen && (
                <AddAppointmentModal 
                    isOpen={isAddModalOpen} 
                    onClose={() => setIsAddModalOpen(false)} 
                    slotDetails={selectedSlot}
                    staffList={staffList}
                    onAdded={handleAppointmentAdded}
                />
            )}
        </div>
    );
};

export default CalendarPage;
