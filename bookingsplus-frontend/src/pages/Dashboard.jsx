import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionContext';
import { Button } from '../ui/Button';
import { Calendar as CalendarIcon, Users, DollarSign, TrendingUp, Plus, ArrowRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays, isSameDay } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../contexts/WorkspaceContext';
import AddAppointmentModal from '../components/calendar/AddAppointmentModal';

const MOCK_STAFF = [
    { id: 1, name: 'Jason Miller' },
    { id: 2, name: 'Emily Carter' },
    { id: 3, name: 'Michael Thompson' },
    { id: 4, name: 'Sarah Johnson' },
    { id: 5, name: 'David Wilson' }
];

const Dashboard = () => {
    const { user } = useAuth();
    const { hasPermission, isSuperAdmin } = usePermissions();
    const { activeWorkspace } = useWorkspace();
    const navigate = useNavigate();
    const wsSlug = activeWorkspace?.workspace_slug || '';
    
    const [appointments, setAppointments] = useState([]);
    const [servicesCount, setServicesCount] = useState(0);
    const [customersCount, setCustomersCount] = useState(0);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    useEffect(() => {
        const loadData = () => {
            const apts = JSON.parse(localStorage.getItem('bp_appointments') || '[]');
            setAppointments(apts);
            
            const srvs = JSON.parse(localStorage.getItem('bp_services') || '[]');
            setServicesCount(srvs.length);

            const custs = JSON.parse(localStorage.getItem('bp_customers') || '[]');
            setCustomersCount(custs.length);
        };
        
        loadData();
    }, []);

    const metrics = useMemo(() => {
        let relevantApts = appointments;
        if (!isSuperAdmin && !hasPermission('appointments.read')) {
            relevantApts = appointments.filter(a => a.staff_name === user?.name);
        }

        const now = new Date();
        const upcomingCount = relevantApts.filter(a => new Date(a.start_time) >= now).length;
        
        // Calculate Revenue
        const totalRevenue = relevantApts.reduce((sum, apt) => {
            let priceStr = apt.price || '';
            if (priceStr.toLowerCase() === 'free') return sum;
            const val = parseFloat(priceStr.replace(/[^0-9.-]+/g, ''));
            return sum + (isNaN(val) ? 0 : val);
        }, 0);

        return {
            totalAppointments: relevantApts.length,
            upcomingAppointments: upcomingCount,
            revenue: totalRevenue.toFixed(2),
        };
    }, [appointments, user]);


    // Generate chart data for last 7 days
    const chartData = useMemo(() => {
        let relevantApts = appointments;
        if (!isSuperAdmin && !hasPermission('appointments.read')) {
            relevantApts = appointments.filter(a => a.staff_name === user?.name);
        }

        const data = [];
        for (let i = 6; i >= 0; i--) {
            const d = subDays(new Date(), i);
            const count = relevantApts.filter(apt => isSameDay(new Date(apt.start_time), d)).length;
            data.push({
                name: format(d, 'EEE'),
                fullDate: format(d, 'MMM dd'),
                appointments: count
            });
        }
        return data;
    }, [appointments, user]);


    // Recent upcoming appointments (sort by soonest)
    const recentUpcoming = useMemo(() => {
        let relevantApts = appointments;
        if (!isSuperAdmin && !hasPermission('appointments.read')) {
            relevantApts = appointments.filter(a => a.staff_name === user?.name);
        }
        
        const now = new Date();
        return relevantApts
            .filter(a => new Date(a.start_time) >= now)
            .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
            .slice(0, 5);
    }, [appointments, user]);

    const handleAppointmentAdded = (newApt) => {
        const updated = [...appointments, newApt];
        setAppointments(updated);
        localStorage.setItem('bp_appointments', JSON.stringify(updated));
    };

    return (
        <div className="page-container" style={{ paddingBottom: '40px' }}>
            <div className="page-header" style={{ marginBottom: '32px' }}>
                <h1 className="page-title" style={{ fontSize: '24px' }}>Dashboard</h1>
                <p className="page-subtitle" style={{ fontSize: '15px' }}>Welcome back, {user?.name}. Here's what's happening today.</p>
            </div>
            
            {/* Top Metrics Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid var(--pk-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div style={{ backgroundColor: '#EEF2FF', padding: '12px', borderRadius: '10px' }}>
                            <TrendingUp size={20} color="#4F46E5" />
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#10B981', backgroundColor: '#D1FAE5', padding: '2px 8px', borderRadius: '12px' }}>+12%</span>
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--pk-text-main)', marginBottom: '4px' }}>{metrics.totalAppointments}</div>
                    <div style={{ fontSize: '14px', color: 'var(--pk-text-muted)' }}>Total Appointments</div>
                </div>

                <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid var(--pk-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div style={{ backgroundColor: '#FEF3C7', padding: '12px', borderRadius: '10px' }}>
                            <CalendarIcon size={20} color="#D97706" />
                        </div>
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--pk-text-main)', marginBottom: '4px' }}>{metrics.upcomingAppointments}</div>
                    <div style={{ fontSize: '14px', color: 'var(--pk-text-muted)' }}>Upcoming Bookings</div>
                </div>

                <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid var(--pk-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div style={{ backgroundColor: '#DCFCE7', padding: '12px', borderRadius: '10px' }}>
                            <DollarSign size={20} color="#059669" />
                        </div>
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--pk-text-main)', marginBottom: '4px' }}>${metrics.revenue}</div>
                    <div style={{ fontSize: '14px', color: 'var(--pk-text-muted)' }}>Estimated Revenue</div>
                </div>

                <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid var(--pk-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div style={{ backgroundColor: '#F3E8FF', padding: '12px', borderRadius: '10px' }}>
                            <Users size={20} color="#9333EA" />
                        </div>
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--pk-text-main)', marginBottom: '4px' }}>{customersCount}</div>
                    <div style={{ fontSize: '14px', color: 'var(--pk-text-muted)' }}>Total Customers</div>
                </div>
            </div>

            {/* Middle Section: Chart & Quick Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '32px' }}>
                {/* Chart Box */}
                <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid var(--pk-border)' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '24px' }}>Appointments Overview (Last 7 Days)</h3>
                    <div style={{ width: '100%', height: '300px' }}>
                        <ResponsiveContainer>
                            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 13 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 13 }} />
                                <Tooltip 
                                    cursor={{ fill: '#F3F4F6' }} 
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    labelStyle={{ fontWeight: 600, color: '#111827', marginBottom: '4px' }}
                                />
                                <Bar dataKey="appointments" fill="#C4B5FD" radius={[6, 6, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Quick Actions & Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid var(--pk-border)' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>Quick Actions</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <Button variant="primary" onClick={() => setIsAddModalOpen(true)} style={{ width: '100%', justifyContent: 'center', gap: '8px', padding: '12px' }}>
                                <Plus size={18} /> Book Appointment
                            </Button>
                            <Button variant="outline" onClick={() => navigate(`/ws/${wsSlug}/services`)} style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
                                Manage Services
                            </Button>
                            <Button variant="outline" onClick={() => navigate(`/ws/${wsSlug}/calendar`)} style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
                                View Calendar
                            </Button>
                        </div>
                    </div>

                    <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid var(--pk-border)', flex: 1 }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>System Status</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10B981' }}></div>
                            <span style={{ fontSize: '14px', color: 'var(--pk-text-main)' }}>All systems operational</span>
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--pk-text-muted)' }}>
                            Hosting <strong style={{color: 'var(--pk-primary)'}}>Catalyst Serverless</strong><br/>
                            Active Services Configured: {servicesCount}
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Section: Recent Activity / Upcoming Bookings */}
            <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid var(--pk-border)', overflow: 'hidden' }}>
                <div style={{ padding: '24px', borderBottom: '1px solid var(--pk-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Upcoming Activity</h3>
                    <button onClick={() => navigate(`/ws/${wsSlug}/appointments`)} style={{ background: 'none', border: 'none', fontSize: '14px', color: 'var(--pk-primary)', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        View All <ArrowRight size={14} />
                    </button>
                </div>
                
                {recentUpcoming.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--pk-text-muted)' }}>
                        No upcoming bookings.
                    </div>
                ) : (
                    <div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', padding: '12px 24px', backgroundColor: '#F8FAFC', borderBottom: '1px solid var(--pk-border)' }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Customer</span>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Service</span>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Staff</span>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>Date & Time</span>
                        </div>
                        {recentUpcoming.map(apt => (
                            <div key={apt.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', padding: '16px 24px', borderBottom: '1px solid #F3F4F6', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#E0E7FF', color: '#4338CA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600 }}>
                                        {apt.customer_name ? apt.customer_name.charAt(0).toUpperCase() : '👤'}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--pk-text-main)' }}>{apt.customer_name}</span>
                                        <span style={{ fontSize: '12px', color: 'var(--pk-text-muted)' }}>{apt.id}</span>
                                    </div>
                                </div>
                                <div style={{ fontSize: '13px', color: 'var(--pk-text-main)' }}>{apt.service_name}</div>
                                <div style={{ fontSize: '13px', color: 'var(--pk-text-main)' }}>{apt.staff_name}</div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--pk-text-main)' }}>{format(new Date(apt.start_time), 'MMM dd, yyyy')}</span>
                                    <span style={{ fontSize: '12px', color: 'var(--pk-text-muted)' }}>{format(new Date(apt.start_time), 'hh:mm a')}</span>
                                </div>
                            </div>
                        ))}
                    </div>
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

export default Dashboard;
