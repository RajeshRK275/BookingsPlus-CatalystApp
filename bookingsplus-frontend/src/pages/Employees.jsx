import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Share2, Plus, Users, Mail, Briefcase, Shield } from 'lucide-react';
import { Button } from '../ui/Button';
import PermissionGate from '../components/PermissionGate';
import AddEmployeeModal from '../components/AddEmployeeModal';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { usersApi } from '../services';

/** Deterministic color palette for employee avatars */
const AVATAR_COLORS = [
    '#4F46E5', '#7C3AED', '#DB2777', '#DC2626', '#EA580C',
    '#D97706', '#059669', '#0891B2', '#2563EB', '#9333EA',
];

const getAvatarColor = (name) => {
    if (!name) return AVATAR_COLORS[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const getInitials = (name) => {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
};

const getRoleBadgeStyle = (role) => {
    const r = (role || '').toLowerCase();
    if (r === 'admin' || r === 'super admin') return { bg: '#FEE2E2', color: '#DC2626' };
    if (r === 'manager') return { bg: '#FEF3C7', color: '#D97706' };
    return { bg: '#E0E7FF', color: '#4338CA' };
};

const Employees = () => {
    const navigate = useNavigate();
    const { activeWorkspace } = useWorkspace();
    const wsSlug = activeWorkspace?.workspace_slug || '';
    const [searchQuery, setSearchQuery] = useState('');
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [fetchError, setFetchError] = useState(null);

    const fetchEmployees = async () => {
        try {
            setLoading(true);
            setFetchError(null);
            console.log('[Employees] Fetching employees... Active workspace:', activeWorkspace?.workspace_id, '| localStorage wsId:', localStorage.getItem('bp_active_workspace'));
            const response = await usersApi.getAll();
            console.log('[Employees] API response:', JSON.stringify(response.data));
            if (response.data && response.data.success) {
                const mapped = (response.data.data || []).map(e => {
                    const name = e.name || e.display_name || 'Unknown';
                    return {
                        ...e,
                        name,
                        id: e.id || e.user_id || e.ROWID,
                        email: e.email || '',
                        role: e.role || e.role_name || 'Staff',
                        designation: e.designation || '',
                        phone: e.phone || '',
                        color: e.color || getAvatarColor(name),
                        initials: e.initials || getInitials(name),
                        status: e.status || 'active',
                        is_super_admin: e.is_super_admin === 'true' || e.is_super_admin === true,
                    };
                });
                console.log('[Employees] Mapped employees:', mapped.length, mapped.map(e => ({ id: e.id, email: e.email, name: e.name })));
                setEmployees(mapped);
            } else {
                setFetchError(response.data?.message || 'Failed to load employees. Please try again.');
            }
        } catch (err) {
            console.error('Error fetching employees:', err.message || err);
            const status = err.status || err.response?.status;
            const apiMessage = err.data?.message || err.response?.data?.message || err.message || '';

            if (status === 400 && apiMessage.includes('Workspace')) {
                setFetchError('Workspace not selected. Please refresh the page or select a workspace from the sidebar.');
            } else if (status === 403) {
                setFetchError('You do not have permission to view employees. Contact your administrator.');
            } else {
                setFetchError(`Failed to load employees: ${apiMessage || 'Unknown error'}. Please try refreshing the page.`);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEmployees();
    }, []);

    const handleEmployeeAdded = () => {
        // Re-fetch employee list after new employee is added
        fetchEmployees();
    };

    const filteredEmployees = employees.filter(emp => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
            (emp.name && emp.name.toLowerCase().includes(q)) ||
            (emp.email && emp.email.toLowerCase().includes(q)) ||
            (emp.designation && emp.designation.toLowerCase().includes(q)) ||
            (emp.role && emp.role.toLowerCase().includes(q))
        );
    });

    return (
        <div className="page-container">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <h1 style={{ fontSize: '18px', fontWeight: 600 }}>Active Employees</h1>
                    <span style={{
                        backgroundColor: '#F3F4F6', color: 'var(--pk-text-muted)',
                        padding: '2px 10px', borderRadius: '12px', fontSize: '13px', fontWeight: 600
                    }}>{employees.length}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--pk-border)',
                        borderRadius: '6px', padding: '7px 12px', backgroundColor: 'white', width: '220px'
                    }}>
                        <Search size={15} color="#9CA3AF" />
                        <input type="text" placeholder="Search" value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ border: 'none', outline: 'none', fontSize: '13px', width: '100%', backgroundColor: 'transparent' }} />
                    </div>
                    <PermissionGate permission="users.create">
                        <Button
                            variant="primary"
                            onClick={() => setIsAddModalOpen(true)}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                            <Plus size={16} /> New Employee
                        </Button>
                    </PermissionGate>
                </div>
            </div>

            {/* Error Banner */}
            {fetchError && !loading && (
                <div style={{
                    backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px',
                    padding: '16px 20px', marginBottom: '20px', display: 'flex', alignItems: 'flex-start', gap: '12px',
                }}>
                    <div style={{
                        width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#FEE2E2',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px',
                    }}>
                        <span style={{ color: '#DC2626', fontSize: '14px', fontWeight: 700 }}>!</span>
                    </div>
                    <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '14px', color: '#991B1B', margin: 0, lineHeight: '1.5', fontWeight: 500 }}>
                            {fetchError}
                        </p>
                        <button
                            onClick={fetchEmployees}
                            style={{
                                marginTop: '10px', padding: '6px 16px', fontSize: '13px', fontWeight: 500,
                                backgroundColor: 'white', border: '1px solid #FECACA', borderRadius: '6px',
                                color: '#DC2626', cursor: 'pointer', fontFamily: 'inherit',
                            }}
                        >
                            Retry
                        </button>
                    </div>
                </div>
            )}

            {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#6B7280' }}>Loading Employees...</div>
            ) : filteredEmployees.length === 0 && !fetchError ? (
                /* Empty State */
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '80px 40px', textAlign: 'center',
                }}>
                    <div style={{
                        width: '72px', height: '72px', borderRadius: '50%', backgroundColor: '#EEF2FF',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px',
                    }}>
                        <Users size={32} color="#4F46E5" />
                    </div>
                    <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>
                        {searchQuery ? 'No employees match your search' : 'No employees yet'}
                    </h2>
                    <p style={{ fontSize: '14px', color: '#6B7280', maxWidth: '400px', lineHeight: '1.6', marginBottom: '24px' }}>
                        {searchQuery
                            ? `No employees found matching "${searchQuery}". Try a different search term.`
                            : 'Add your first staff member to get started. They\'ll receive an email invitation to join your workspace.'}
                    </p>
                    {!searchQuery && (
                        <PermissionGate permission="users.create">
                            <Button
                                variant="primary"
                                onClick={() => setIsAddModalOpen(true)}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px' }}
                            >
                                <Plus size={18} /> Add Your First Employee
                            </Button>
                        </PermissionGate>
                    )}
                </div>
            ) : (
                /* Employee Cards Grid */
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                    {filteredEmployees.map(emp => {
                        const badgeStyle = getRoleBadgeStyle(emp.role);
                        return (
                            <div key={emp.id || emp.user_id}
                                onClick={() => navigate(`/ws/${wsSlug}/employees/${emp.id || emp.user_id}`)}
                                style={{
                                    backgroundColor: 'white', borderRadius: '12px', padding: '24px',
                                    border: '1px solid var(--pk-border)', cursor: 'pointer',
                                    transition: 'box-shadow 0.2s, transform 0.1s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
                            >
                                {/* Avatar + Name */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                                    <div style={{
                                        width: '48px', height: '48px', borderRadius: '50%', backgroundColor: emp.color,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                                        fontSize: '15px', fontWeight: 700, flexShrink: 0, letterSpacing: '0.5px',
                                    }}>
                                        {emp.initials}
                                    </div>
                                    <div style={{ overflow: 'hidden', flex: 1 }}>
                                        <div style={{
                                            display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px',
                                        }}>
                                            <span style={{
                                                fontSize: '15px', fontWeight: 600, color: 'var(--pk-text-main)',
                                                whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden',
                                            }}>{emp.name}</span>
                                            {emp.is_super_admin && (
                                                <Shield size={13} color="#DC2626" style={{ flexShrink: 0 }} title="Super Admin" />
                                            )}
                                        </div>
                                        <div style={{
                                            fontSize: '12px', color: 'var(--pk-text-muted)',
                                            whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden',
                                            display: 'flex', alignItems: 'center', gap: '4px',
                                        }}>
                                            <Mail size={11} style={{ flexShrink: 0 }} />
                                            {emp.email}
                                        </div>
                                    </div>
                                </div>

                                {/* Details Row */}
                                <div style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    paddingTop: '14px', borderTop: '1px solid #F3F4F6',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{
                                            backgroundColor: badgeStyle.bg, color: badgeStyle.color,
                                            fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '6px',
                                        }}>
                                            {emp.role}
                                        </span>
                                        {emp.designation && (
                                            <span style={{
                                                display: 'flex', alignItems: 'center', gap: '4px',
                                                fontSize: '12px', color: 'var(--pk-text-muted)',
                                            }}>
                                                <Briefcase size={11} /> {emp.designation}
                                            </span>
                                        )}
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); }} style={{
                                        display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px',
                                        backgroundColor: 'white', border: '1px solid var(--pk-border)', borderRadius: '6px',
                                        fontSize: '13px', fontWeight: 500, color: 'var(--pk-primary)', cursor: 'pointer',
                                    }}>
                                        <Share2 size={13} /> Share
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add Employee Modal */}
            <AddEmployeeModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onEmployeeAdded={handleEmployeeAdded}
            />
        </div>
    );
};

export default Employees;
