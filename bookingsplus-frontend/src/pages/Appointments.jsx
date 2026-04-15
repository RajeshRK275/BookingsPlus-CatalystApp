import React, { useState, useMemo } from 'react';
import { Button } from '../ui/Button';
import { Plus, Search, HelpCircle, Clock, Calendar } from 'lucide-react';
import AddAppointmentModal from '../components/calendar/AddAppointmentModal';

const MOCK_STAFF = [
    { id: 1, name: 'Jason Miller' },
    { id: 2, name: 'Emily Carter' },
    { id: 3, name: 'Michael Thompson' },
    { id: 4, name: 'Sarah Johnson' },
    { id: 5, name: 'David Wilson' }
];

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatTime = (isoString) => {
    if (!isoString) return '-';
    const d = new Date(isoString);
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'pm' : 'am';
    const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${hour.toString().padStart(2, '0')}:${m} ${ampm}`;
};

const formatTimeRange = (start, end) => `${formatTime(start)} - ${formatTime(end)}`;

const formatDateHeader = (isoString) => {
    const d = new Date(isoString);
    return `${d.getDate().toString().padStart(2, '0')} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
};

const getInitials = (name) => name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '??';

const StatusBadge = ({ status }) => {
    const styles = {
        upcoming: { bg: '#FEF3C7', color: '#92400E', label: 'Upcoming' },
        completed: { bg: '#DCFCE7', color: '#166534', label: 'Completed' },
        cancelled: { bg: '#FEE2E2', color: '#991B1B', label: 'Cancelled' },
        pending: { bg: '#F3F0FF', color: '#5C44B5', label: 'Pending' }
    };
    const s = styles[status] || styles.upcoming;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 500,
            backgroundColor: s.bg, color: s.color
        }}>{s.label}</span>
    );
};

const Appointments = () => {
    const [activeTab, setActiveTab] = useState('Upcoming');
    const [searchQuery, setSearchQuery] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    const [appointments, setAppointments] = useState(() => {
        return JSON.parse(localStorage.getItem('bp_appointments') || '[]');
    });

    const handleAppointmentAdded = (newApt) => {
        const updated = [...appointments, newApt];
        setAppointments(updated);
        localStorage.setItem('bp_appointments', JSON.stringify(updated));
    };

    // Group by date
    const groupedAppointments = useMemo(() => {
        let filtered = [...appointments];

        // Search filter
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(a =>
                (a.service_name || '').toLowerCase().includes(q) ||
                (a.customer_name || '').toLowerCase().includes(q) ||
                (a.id || '').toLowerCase().includes(q)
            );
        }

        // Tab filter
        const now = new Date();
        if (activeTab === 'Upcoming') {
            filtered = filtered.filter(a => new Date(a.start_time) >= now || a.status === 'upcoming');
        } else if (activeTab === 'Past') {
            filtered = filtered.filter(a => new Date(a.start_time) < now && a.status !== 'upcoming');
        }

        // Sort by start_time
        filtered.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

        // Group by date
        const groups = {};
        filtered.forEach(apt => {
            const dateKey = new Date(apt.start_time).toDateString();
            if (!groups[dateKey]) groups[dateKey] = [];
            groups[dateKey].push(apt);
        });

        return groups;
    }, [appointments, searchQuery, activeTab]);

    const totalCount = Object.values(groupedAppointments).reduce((sum, arr) => sum + arr.length, 0);

    return (
        <div className="page-container">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h1 style={{ fontSize: '20px', fontWeight: 600 }}>Appointments</h1>
                    <HelpCircle size={16} color="#9CA3AF" style={{ cursor: 'pointer' }} />
                </div>
                <Button variant="primary" onClick={() => setIsAddModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={16} /> New Appointment
                </Button>
            </div>

            {/* Tabs + Search */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid var(--pk-border)', marginBottom: '0' }}>
                <div style={{ display: 'flex', gap: '0' }}>
                    {['Upcoming', 'Past', 'Custom Date'].map(tab => (
                        <div
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                padding: '12px 20px', cursor: 'pointer', fontSize: '14px',
                                fontWeight: activeTab === tab ? 500 : 400,
                                color: activeTab === tab ? 'var(--pk-primary)' : 'var(--pk-text-muted)',
                                borderBottom: activeTab === tab ? '2px solid var(--pk-primary)' : '2px solid transparent'
                            }}
                        >{tab}</div>
                    ))}
                </div>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--pk-border)',
                    borderRadius: '6px', padding: '7px 12px', backgroundColor: 'white', width: '200px', marginBottom: '8px'
                }}>
                    <Search size={15} color="#9CA3AF" />
                    <input type="text" placeholder="Search" value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ border: 'none', outline: 'none', fontSize: '13px', width: '100%', backgroundColor: 'transparent' }} />
                </div>
            </div>

            {/* Table */}
            <div style={{ backgroundColor: 'white', border: '1px solid var(--pk-border)', borderTop: 'none' }}>
                {/* Column Headers */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1.3fr 0.8fr 1.2fr 1.2fr 1fr 0.8fr 0.6fr 0.8fr',
                    padding: '10px 16px', backgroundColor: '#F8FAFC',
                    borderBottom: '1px solid var(--pk-border)'
                }}>
                    {['TIME', 'BOOKING ID', 'SERVICE', 'EMPLOYEES / RESOURCES', 'CUSTOMERS', 'PAYMENT STATUS', 'PRICE', 'STATUS'].map(col => (
                        <span key={col} style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569' }}>
                            {col}
                        </span>
                    ))}
                </div>

                {totalCount === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center' }}>
                        <div style={{ marginBottom: '16px' }}>
                            <Calendar size={48} color="#D1D5DB" />
                        </div>
                        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>No appointments found</h3>
                        <p style={{ color: 'var(--pk-text-muted)', fontSize: '14px' }}>
                            {activeTab === 'Upcoming' ? 'No upcoming appointments. Share your services to start getting bookings!' : 'No past appointments found.'}
                        </p>
                    </div>
                ) : (
                    Object.entries(groupedAppointments).map(([dateKey, apts]) => (
                        <div key={dateKey}>
                            {/* Date Group Header */}
                            <div style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '10px 16px', backgroundColor: '#FAFAFA',
                                borderBottom: '1px solid #F3F4F6'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--pk-text-main)' }}>
                                    <Calendar size={14} color="var(--pk-primary)" />
                                    {formatDateHeader(apts[0].start_time)}
                                </div>
                                <span style={{ fontSize: '12px', color: 'var(--pk-primary)', fontWeight: 500 }}>
                                    {apts.length} Appointment{apts.length > 1 ? 's' : ''}
                                </span>
                            </div>

                            {/* Appointment Rows */}
                            {apts.map((apt, i) => (
                                <div key={apt.id || i} style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1.3fr 0.8fr 1.2fr 1.2fr 1fr 0.8fr 0.6fr 0.8fr',
                                    padding: '12px 16px', borderBottom: '1px solid #F3F4F6',
                                    alignItems: 'center', cursor: 'pointer', transition: 'background-color 0.15s'
                                }}
                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#FAFAFA'}
                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}
                                >
                                    {/* Time */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                                        <Clock size={13} color="var(--pk-primary)" />
                                        {formatTimeRange(apt.start_time, apt.end_time)}
                                    </div>

                                    {/* Booking ID */}
                                    <span style={{ fontSize: '13px', color: 'var(--pk-text-muted)' }}>{apt.id}</span>

                                    {/* Service */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{
                                            width: '24px', height: '24px', borderRadius: '4px',
                                            backgroundColor: '#C4B5FD', color: 'white',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '9px', fontWeight: 600, flexShrink: 0
                                        }}>{getInitials(apt.service_name)}</div>
                                        <span style={{ fontSize: '13px', fontWeight: 500 }}>{apt.service_name}</span>
                                    </div>

                                    {/* Employee */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{
                                            width: '24px', height: '24px', borderRadius: '50%',
                                            backgroundColor: '#E5E7EB', color: '#6B7280',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '9px', fontWeight: 600
                                        }}>{getInitials(apt.staff_name)}</div>
                                        <span style={{ fontSize: '13px' }}>{apt.staff_name || '-'}</span>
                                    </div>

                                    {/* Customer */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
                                        <span style={{ color: 'var(--pk-text-muted)' }}>👤</span>
                                        {apt.customer_name}
                                    </div>

                                    {/* Payment Status */}
                                    <span style={{ fontSize: '13px', color: 'var(--pk-text-muted)' }}>{apt.payment_status || 'Free'}</span>

                                    {/* Price */}
                                    <span style={{ fontSize: '13px', color: 'var(--pk-text-muted)' }}>{apt.price || 'Free'}</span>

                                    {/* Status */}
                                    <StatusBadge status={apt.status || 'upcoming'} />
                                </div>
                            ))}
                        </div>
                    ))
                )}
            </div>

            <AddAppointmentModal 
                isOpen={isAddModalOpen} 
                onClose={() => setIsAddModalOpen(false)} 
                slotDetails={null}
                staffList={MOCK_STAFF}
                onAdded={handleAppointmentAdded}
            />
        </div>
    );
};

export default Appointments;
