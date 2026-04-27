import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Plus, Search, Share2, LayoutGrid, List, ChevronDown } from 'lucide-react';
import { CreateServiceModal } from '../components/CreateServiceModal';
import ShareServiceModal from '../components/ShareServiceModal';
import { useWorkspace } from '../contexts/WorkspaceContext';
import PermissionGate from '../components/PermissionGate';
import { servicesApi, usersApi } from '../services';

const getInitials = (name) => name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : 'SV';

const formatDuration = (mins) => {
    if (!mins) return '-';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h && m) return `${h} Hour${h > 1 ? 's' : ''} ${m} mins`;
    if (h) return `${h} Hour${h > 1 ? 's' : ''}`;
    return `${m} mins`;
};

const formatType = (type) => {
    if (!type) return 'One-on-One';
    const map = { 'one-on-one': 'One-on-One', 'group': 'Group Booking', 'collective': 'Collective Booking', 'resource': 'Resource' };
    return map[type] || type;
};

const AVATAR_COLORS = ['#C4B5FD', '#6EE7B7', '#FCA5A5', '#93C5FD', '#FDBA74'];

const Services = () => {
    const { activeWorkspace } = useWorkspace();
    const navigate = useNavigate();
    const wsSlug = activeWorkspace?.workspace_slug || '';
    const [services, setServices] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState('list');
    const [shareService, setShareService] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [svcRes, empRes] = await Promise.allSettled([
                    servicesApi.getAll(),
                    usersApi.getAll(),
                ]);
                if (svcRes.status === 'fulfilled' && svcRes.value.data?.success) {
                    const normalized = (svcRes.value.data.data || []).map(s => ({
                        ...s,
                        name: s.name || s.service_name || 'Untitled Service',
                        id: s.id || s.service_id || s.ROWID,
                    }));
                    setServices(normalized);
                }
                if (empRes.status === 'fulfilled' && empRes.value.data?.success) {
                    setEmployees((empRes.value.data.data || []).map(e => ({
                        ...e,
                        id: e.id || e.user_id || e.ROWID,
                        name: e.name || e.display_name || 'Unknown',
                    })));
                }
            } catch (err) {
                console.error('Error fetching services/employees:', err.message || err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleServiceCreated = (newService) => {
        setServices(prev => [...prev, newService]);
    };

    const filteredServices = services.filter(s =>
        (s.name || s.service_name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const activeCount = services.filter(s => s.status === 'active').length;

    return (
        <div className="page-container">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <h1 style={{ fontSize: '18px', fontWeight: 600 }}>Active Services</h1>
                    <span style={{
                        backgroundColor: '#EDE9F6', color: 'var(--pk-primary)',
                        padding: '2px 10px', borderRadius: '12px', fontSize: '13px', fontWeight: 600
                    }}>{activeCount}</span>
                    <ChevronDown size={16} color="var(--pk-text-muted)" style={{ cursor: 'pointer' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Search */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--pk-border)',
                        borderRadius: '6px', padding: '7px 12px', backgroundColor: 'white', width: '220px'
                    }}>
                        <Search size={15} color="#9CA3AF" />
                        <input type="text" placeholder="Search Services" value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ border: 'none', outline: 'none', fontSize: '13px', width: '100%', backgroundColor: 'transparent' }} />
                    </div>
                    {/* View toggle */}
                    <div style={{ display: 'flex', border: '1px solid var(--pk-border)', borderRadius: '6px', overflow: 'hidden' }}>
                        <button onClick={() => setViewMode('grid')}
                            style={{
                                padding: '7px 10px', border: 'none', cursor: 'pointer',
                                backgroundColor: viewMode === 'grid' ? '#F3F0FF' : 'white',
                                color: viewMode === 'grid' ? 'var(--pk-primary)' : '#9CA3AF',
                                display: 'flex', alignItems: 'center'
                            }}><LayoutGrid size={16} /></button>
                        <button onClick={() => setViewMode('list')}
                            style={{
                                padding: '7px 10px', border: 'none', borderLeft: '1px solid var(--pk-border)',
                                cursor: 'pointer',
                                backgroundColor: viewMode === 'list' ? '#F3F0FF' : 'white',
                                color: viewMode === 'list' ? 'var(--pk-primary)' : '#9CA3AF',
                                display: 'flex', alignItems: 'center'
                            }}><List size={16} /></button>
                    </div>
                    <PermissionGate permission="services.create">
                        <Button variant="primary" onClick={() => setIsModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Plus size={16} /> New Service
                        </Button>
                    </PermissionGate>
                </div>
            </div>

            {/* Table */}
            <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid var(--pk-border)', overflow: 'hidden' }}>
                {/* Table Header */}
                <div style={{
                    display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1fr 0.8fr',
                    padding: '12px 20px', borderBottom: '1px solid var(--pk-border)',
                    backgroundColor: '#F8FAFC'
                }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569' }}>Event Type Name</span>
                    <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569' }}>Type</span>
                    <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569' }}>Duration</span>
                    <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569' }}>Staff</span>
                    <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569', textAlign: 'right' }}>Actions</span>
                </div>
{/* Table Rows */}
                {isLoading ? (
                    <div style={{ padding: '48px', textAlign: 'center', color: 'var(--pk-text-muted)' }}>
                        Loading services...
                    </div>
                ) : filteredServices.length === 0 ? (
                    <div style={{ padding: '48px', textAlign: 'center', color: 'var(--pk-text-muted)' }}>
                        No services found.
                    </div>
                ) : (
                    filteredServices.map((service) => {
                        const staffList = (service.assignedStaff || [])
                            .map(id => employees.find(s => String(s.id) === String(id)))
                            .filter(Boolean);

                        return (
                            <div
                                key={service.id}
                                onClick={() => navigate(`/ws/${wsSlug}/services/${service.id || service.service_id || service.ROWID}`)}
                                style={{
                                    display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1fr 0.8fr',
                                    padding: '14px 20px', borderBottom: '1px solid #F3F4F6',
                                    cursor: 'pointer', alignItems: 'center', transition: 'background-color 0.15s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FAFAFA'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                            >
                                {/* Name with initials */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                        width: '32px', height: '32px', borderRadius: '50%',
                                        backgroundColor: AVATAR_COLORS[service.id % AVATAR_COLORS.length],
                                        color: 'white', display: 'flex', alignItems: 'center',
                                        justifyContent: 'center', fontSize: '11px', fontWeight: 600, flexShrink: 0
                                    }}>{getInitials(service.name)}</div>
                                    <span style={{ fontSize: '14px', fontWeight: 500 }}>{service.name}</span>
                                </div>

                                {/* Type */}
                                <span style={{ fontSize: '13px', color: 'var(--pk-text-muted)' }}>{formatType(service.service_type || service.type)}</span>

                                {/* Duration */}
                                <span style={{ fontSize: '13px', color: 'var(--pk-text-muted)' }}>{formatDuration(service.duration_minutes || service.duration)}</span>

                                {/* Staff avatars */}
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    {staffList.length === 0 ? (
                                        <span style={{ fontSize: '12px', color: '#D1D5DB' }}>—</span>
                                    ) : (
                                        staffList.slice(0, 3).map((staff, i) => (
                                            <div key={staff.id} title={staff.name} style={{
                                                width: '28px', height: '28px', borderRadius: '50%',
                                                backgroundColor: '#E5E7EB', color: '#6B7280',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '10px', fontWeight: 600, border: '2px solid white',
                                                marginLeft: i > 0 ? '-6px' : '0'
                                            }}>{getInitials(staff.name)}</div>
                                        ))
                                    )}
                                    {staffList.length > 3 && (
                                        <div style={{
                                            width: '28px', height: '28px', borderRadius: '50%',
                                            backgroundColor: '#F3F4F6', color: '#9CA3AF',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '9px', fontWeight: 600, border: '2px solid white', marginLeft: '-6px'
                                        }}>+{staffList.length - 3}</div>
                                    )}
                                </div>

                                {/* Share action */}
                                <div style={{ textAlign: 'right' }}>
                                    <button onClick={(e) => { e.stopPropagation(); setShareService(service); }}
                                        style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                                            background: 'none', border: 'none', cursor: 'pointer',
                                            color: 'var(--pk-primary)', fontSize: '13px', fontWeight: 500
                                        }}>
                                        <Share2 size={13} /> Share
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <CreateServiceModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onServiceCreated={handleServiceCreated}
            />

            <ShareServiceModal
                isOpen={!!shareService}
                onClose={() => setShareService(null)}
                service={shareService}
            />
        </div>
    );
};

export default Services;
