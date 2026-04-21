import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { X, MoreVertical, Share2, ClipboardCopy, Trash2, Copy, MoveRight, CheckSquare, Users, Clock, CalendarDays, Bell, FileText } from 'lucide-react';
import ServiceDetailsTab from '../components/service-tabs/ServiceDetailsTab';
import AssignedGroupsTab from '../components/service-tabs/AssignedGroupsTab';
import AvailabilityLimitsTab from '../components/service-tabs/AvailabilityLimitsTab';
import SchedulingRulesTab from '../components/service-tabs/SchedulingRulesTab';
import NotificationPreferencesTab from '../components/service-tabs/NotificationPreferencesTab';
import BookingFormTab from '../components/service-tabs/BookingFormTab';
import ShareServiceModal from '../components/ShareServiceModal';
import axios from 'axios';

const TABS = [
    { id: 'details', label: 'Service Details', desc: 'Set the duration, payment type, and meeting mode.', icon: CheckSquare },
    { id: 'groups', label: 'Assigned Groups', desc: 'List of groups offering this event type.', icon: Users },
    { id: 'availability', label: 'Availability and Limits', desc: 'Set the date and time for this Service.', icon: Clock },
    { id: 'scheduling', label: 'Scheduling Rules', desc: 'Set buffers, notices, and intervals.', icon: CalendarDays },
    { id: 'notifications', label: 'Notification Preferences', desc: 'Configure email, SMS, and calendar notifications.', icon: Bell },
    { id: 'bookingform', label: 'Booking Form', desc: 'Collect Customer information during booking.', icon: FileText }
];

const ServiceDetail = () => {
    const { serviceId } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('details');
    const [service, setService] = useState({ name: 'Loading...', type: 'one-on-one' });
    const [showMenu, setShowMenu] = useState(false);
    const [showShare, setShowShare] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchService = async () => {
            try {
                const response = await axios.get('/server/bookingsplus/api/v1/services');
                if (response.data && response.data.success) {
                    const svc = response.data.data.find(s => String(s.id || s.service_id) === String(serviceId));
                    if (svc) setService(svc);
                }
            } catch (err) {
                 const services = JSON.parse(localStorage.getItem('bp_services') || '[]');
                 const svc = services.find(s => String(s.id) === String(serviceId));
                 if (svc) setService(svc);
            } finally {
                setLoading(false);
            }
        };
        fetchService();
    }, [serviceId]);

    const getInitials = (name) => name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : 'SV';

    const handleUpdate = async (updatedService) => {
        setService(updatedService);
        try {
            const targetId = updatedService.id || updatedService.service_id;
            await axios.put(`/server/bookingsplus/api/v1/services/${targetId}`, updatedService);
        } catch (err) {
            console.error('API update failed, updating local fallback', err);
            const services = JSON.parse(localStorage.getItem('bp_services') || '[]');
            const index = services.findIndex(s => String(s.id) === String(updatedService.id));
            if (index >= 0) services[index] = updatedService;
            else services.push(updatedService);
            localStorage.setItem('bp_services', JSON.stringify(services));
        }
    };

    const handleDelete = async () => {
        try {
            const targetId = service.id || service.service_id;
            await axios.delete(`/server/bookingsplus/api/v1/services/${targetId}`);
        } catch (err) {
            console.error('API delete failed, deleting local fallback', err);
            const services = JSON.parse(localStorage.getItem('bp_services') || '[]');
            const filtered = services.filter(s => String(s.id) !== String(serviceId));
            localStorage.setItem('bp_services', JSON.stringify(filtered));
        } finally {
            navigate('/services');
        }
    };

    const handleClose = () => navigate('/services');

    const typeVar = service.service_type || service.type || 'one-on-one';
    const typeLabel = typeVar.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-');

    if (loading) return <div style={{ padding: '24px' }}>Loading...</div>;

    const renderTab = () => {
        switch (activeTab) {
            case 'details': return <ServiceDetailsTab service={service} onUpdate={handleUpdate} />;
            case 'groups': return <AssignedGroupsTab service={service} onUpdate={handleUpdate} />;
            case 'availability': return <AvailabilityLimitsTab service={service} onUpdate={handleUpdate} />;
            case 'scheduling': return <SchedulingRulesTab service={service} onUpdate={handleUpdate} />;
            case 'notifications': return <NotificationPreferencesTab service={service} onUpdate={handleUpdate} />;
            case 'bookingform': return <BookingFormTab service={service} onUpdate={handleUpdate} />;
            default: return <ServiceDetailsTab service={service} onUpdate={handleUpdate} />;
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#F9FAFB' }}>
            {/* Top Header Bar */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px 24px', backgroundColor: '#EDE9F6', borderBottom: '1px solid var(--pk-border)',
                flexShrink: 0
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                        width: '40px', height: '40px', borderRadius: '10px',
                        backgroundColor: '#C4B5FD', color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '14px', fontWeight: 600
                    }}>{getInitials(service.name)}</div>
                    <div>
                        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--pk-text-main)' }}>{service.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--pk-text-muted)' }}>{typeLabel}</div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button onClick={() => setShowShare(true)} style={{
                        display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
                        border: '1px solid var(--pk-border)', borderRadius: '6px', backgroundColor: 'white',
                        cursor: 'pointer', fontSize: '13px', fontWeight: 500
                    }}>
                        <Share2 size={14} /> Share
                    </button>
                    <div style={{ position: 'relative' }}>
                        <button onClick={() => setShowMenu(!showMenu)} className="icon-btn">
                            <MoreVertical size={18} />
                        </button>
                        {showMenu && (
                            <div style={{
                                position: 'absolute', top: '100%', right: 0, marginTop: '4px',
                                backgroundColor: 'white', border: '1px solid var(--pk-border)',
                                borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                width: '180px', zIndex: 50, overflow: 'hidden'
                            }}>
                                <div onClick={handleDelete} style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '10px 16px', cursor: 'pointer', color: '#EF4444', fontSize: '13px'
                                }}
                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#FEF2F2'}
                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}>
                                    <Trash2 size={14} /> Delete
                                </div>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '10px 16px', cursor: 'pointer', fontSize: '13px',
                                    color: 'var(--pk-text-main)'
                                }}
                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#F9FAFB'}
                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}>
                                    <Copy size={14} /> Make a copy
                                </div>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '10px 16px', cursor: 'pointer', fontSize: '13px',
                                    color: 'var(--pk-text-main)'
                                }}
                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#F9FAFB'}
                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}>
                                    <MoveRight size={14} /> Move
                                </div>
                            </div>
                        )}
                    </div>
                    <button onClick={handleClose} className="icon-btn">
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Body */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* Left Tab Navigation */}
                <div style={{
                    width: '280px', flexShrink: 0, backgroundColor: 'white',
                    borderRight: '1px solid var(--pk-border)', overflowY: 'auto', padding: '8px 0'
                }}>
                    {TABS.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <div
                                key={tab.id}
                                onClick={() => { setActiveTab(tab.id); setShowMenu(false); }}
                                style={{
                                    display: 'flex', alignItems: 'flex-start', gap: '12px',
                                    padding: '14px 20px', cursor: 'pointer',
                                    backgroundColor: isActive ? '#F5F3FF' : 'transparent',
                                    borderLeft: isActive ? '3px solid var(--pk-primary)' : '3px solid transparent',
                                    transition: 'all 0.15s'
                                }}
                                onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = '#FAFAFA'; }}
                                onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                                <Icon size={18} color={isActive ? 'var(--pk-primary)' : '#9CA3AF'} style={{ marginTop: '2px', flexShrink: 0 }} />
                                <div>
                                    <div style={{
                                        fontSize: '13px', fontWeight: isActive ? 600 : 500,
                                        color: isActive ? 'var(--pk-primary)' : 'var(--pk-text-main)',
                                        marginBottom: '2px'
                                    }}>{tab.label}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--pk-text-muted)', lineHeight: '1.4' }}>
                                        {tab.desc}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Right Content Area */}
                <div style={{
                    flex: 1, overflowY: 'auto', padding: '28px 32px', backgroundColor: 'white'
                }}>
                    {/* Tab title */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px',
                        paddingBottom: '16px', borderBottom: '1px solid var(--pk-border)'
                    }}>
                        <div style={{ width: '3px', height: '20px', backgroundColor: 'var(--pk-primary)', borderRadius: '2px' }} />
                        <h2 style={{ fontSize: '16px', fontWeight: 600 }}>
                            {TABS.find(t => t.id === activeTab)?.label}
                        </h2>
                    </div>
                    {renderTab()}
                </div>
            </div>

            <ShareServiceModal
                isOpen={showShare}
                onClose={() => setShowShare(false)}
                service={service}
            />
        </div>
    );
};

export default ServiceDetail;
