import React, { useState, useEffect } from 'react';
import { Search, X, AlertCircle } from 'lucide-react';
import { Button } from '../../ui/Button';
import { usersApi, servicesApi } from '../../services';

const getInitials = (name) => name ? name.split(' ').map(w => w[0]).join('').toUpperCase() : '??';

const AssignedGroupsTab = ({ service, onUpdate }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [allStaff, setAllStaff] = useState([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const isResource = (service.service_type || service.type) === 'resource';
    const serviceId = service.id || service.service_id || service.ROWID;

    // Fetch all workspace employees
    useEffect(() => {
        const fetchStaff = async () => {
            try {
                const res = await usersApi.getAll();
                if (res.data?.success) {
                    setAllStaff((res.data.data || []).map(e => ({
                        id: e.id || e.user_id || e.ROWID,
                        name: e.name || e.display_name || 'Unknown',
                        email: e.email || '',
                    })));
                }
            } catch (err) {
                console.error('Error fetching staff:', err.message || err);
            }
        };
        fetchStaff();
    }, []);

    // Fetch currently assigned staff from the real ServiceStaff table
    useEffect(() => {
        if (!serviceId) return;
        const fetchAssigned = async () => {
            try {
                const res = await servicesApi.getStaff(serviceId);
                if (res.data?.success) {
                    const ids = (res.data.data || []).map(s => s.staff_id).filter(Boolean);
                    setSelectedStaff(ids);
                }
            } catch (err) {
                // Fallback to service.assignedStaff if API not available
                setSelectedStaff(service.assignedStaff || []);
            }
        };
        fetchAssigned();
    }, [serviceId]); // eslint-disable-line react-hooks/exhaustive-deps

    const filteredStaff = allStaff.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const toggleStaff = (staffId) => {
        setSelectedStaff(prev =>
            prev.includes(staffId) ? prev.filter(id => id !== staffId) : [...prev, staffId]
        );
        setError('');
    };

    const handleSave = async () => {
        // Validate: non-resource services must keep at least 1 staff
        if (!isResource && selectedStaff.length === 0) {
            setError('At least one employee must be assigned to this service. Resource-type services are the only exception.');
            return;
        }

        setSaving(true);
        setError('');
        try {
            await servicesApi.replaceStaff(serviceId, selectedStaff);
            onUpdate({ ...service, assignedStaff: selectedStaff, staffCount: selectedStaff.length });
            setIsEditing(false);
        } catch (err) {
            const msg = err.response?.data?.message || err.data?.message || err.message || 'Failed to update staff assignments.';
            setError(msg);
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        // Reset to current assignments
        if (serviceId) {
            servicesApi.getStaff(serviceId).then(res => {
                if (res.data?.success) {
                    setSelectedStaff((res.data.data || []).map(s => s.staff_id).filter(Boolean));
                }
            }).catch(() => setSelectedStaff(service.assignedStaff || []));
        } else {
            setSelectedStaff(service.assignedStaff || []);
        }
        setIsEditing(false);
        setError('');
    };

    const handleRemoveStaff = async (staffIdToRemove) => {
        if (!isResource && selectedStaff.length <= 1) {
            setError('Cannot remove the last staff member. At least one employee must be assigned.');
            return;
        }
        const updated = selectedStaff.filter(id => id !== staffIdToRemove);
        try {
            await servicesApi.replaceStaff(serviceId, updated);
            setSelectedStaff(updated);
            onUpdate({ ...service, assignedStaff: updated, staffCount: updated.length });
        } catch (err) {
            const msg = err.response?.data?.message || err.data?.message || err.message || 'Failed to remove staff.';
            setError(msg);
        }
    };

    const assignedStaffList = allStaff.filter(s => selectedStaff.includes(s.id));

    if (isEditing) {
        return (
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Manage Staff Assignments</h3>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <Button variant="primary" onClick={handleSave} disabled={saving}>
                            {saving ? 'Saving...' : 'Save'}
                        </Button>
                        <Button variant="secondary" onClick={handleCancel} disabled={saving}>Cancel</Button>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div style={{
                        backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px',
                        padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px',
                        fontSize: '13px', color: '#DC2626',
                    }}>
                        <AlertCircle size={16} />
                        <span>{error}</span>
                    </div>
                )}

                {/* Info banner */}
                {!isResource && (
                    <div style={{
                        backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '8px',
                        padding: '10px 14px', marginBottom: '16px', fontSize: '12px', color: '#1E40AF',
                    }}>
                        ℹ️ Non-resource services require at least one assigned employee. Selected: <strong>{selectedStaff.length}</strong>
                    </div>
                )}

                {/* Search */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--pk-border)',
                    borderRadius: '6px', padding: '8px 12px', marginBottom: '16px', backgroundColor: '#FAFAFA'
                }}>
                    <Search size={16} color="#9CA3AF" />
                    <input type="text" placeholder="Search staff..." value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ border: 'none', outline: 'none', fontSize: '14px', backgroundColor: 'transparent', width: '100%' }} />
                </div>

                {/* Staff list */}
                <div style={{ border: '1px solid var(--pk-border)', borderRadius: '8px', overflow: 'hidden' }}>
                    {filteredStaff.length === 0 ? (
                        <div style={{ padding: '24px', textAlign: 'center', color: '#9CA3AF', fontSize: '14px' }}>
                            {allStaff.length === 0 ? 'No employees in this workspace. Add employees first from the Employees page.' : 'No employees match your search.'}
                        </div>
                    ) : (
                        filteredStaff.map(staff => {
                            const isSelected = selectedStaff.includes(staff.id);
                            return (
                                <div key={staff.id} onClick={() => toggleStaff(staff.id)}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '14px 20px', cursor: 'pointer', borderBottom: '1px solid #F3F4F6',
                                        backgroundColor: isSelected ? '#FAFAFF' : 'white', transition: 'background-color 0.15s'
                                    }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                        <div style={{
                                            width: '36px', height: '36px', borderRadius: '50%',
                                            backgroundColor: isSelected ? '#EDE9F6' : '#F3F4F6',
                                            color: isSelected ? 'var(--pk-primary)' : '#9CA3AF',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '13px', fontWeight: 500
                                        }}>{getInitials(staff.name)}</div>
                                        <div>
                                            <span style={{ fontSize: '14px', fontWeight: 500, display: 'block' }}>{staff.name}</span>
                                            {staff.email && <span style={{ fontSize: '12px', color: '#9CA3AF' }}>{staff.email}</span>}
                                        </div>
                                    </div>
                                    <input type="checkbox" checked={isSelected} readOnly
                                        style={{ width: '18px', height: '18px', accentColor: 'var(--pk-primary)', pointerEvents: 'none' }} />
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        );
    }

    // View mode
    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Assigned Staff</h3>
                    <span style={{
                        backgroundColor: '#F3F4F6', color: '#6B7280', fontSize: '12px',
                        padding: '2px 8px', borderRadius: '12px', fontWeight: 600,
                    }}>{assignedStaffList.length}</span>
                </div>
                <Button variant="secondary" onClick={() => setIsEditing(true)}>✏️ Edit</Button>
            </div>

            {/* Error */}
            {error && (
                <div style={{
                    backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px',
                    padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px',
                    fontSize: '13px', color: '#DC2626',
                }}>
                    <AlertCircle size={16} />
                    <span>{error}</span>
                    <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', marginLeft: 'auto' }}>×</button>
                </div>
            )}

            {assignedStaffList.length === 0 ? (
                <div style={{
                    padding: '48px', textAlign: 'center', border: '1px dashed var(--pk-border)',
                    borderRadius: '8px', color: 'var(--pk-text-muted)'
                }}>
                    <p style={{ fontSize: '14px', marginBottom: '4px' }}>No staff assigned to this service yet.</p>
                    {!isResource && (
                        <p style={{ fontSize: '12px', color: '#EF4444', marginBottom: '12px' }}>
                            ⚠️ This service requires at least one assigned employee to accept bookings.
                        </p>
                    )}
                    <Button variant="primary" onClick={() => setIsEditing(true)}>+ Assign Staff</Button>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {assignedStaffList.map(staff => (
                        <div key={staff.id} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '12px 16px', backgroundColor: 'white', borderRadius: '8px',
                            border: '1px solid var(--pk-border)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                    width: '36px', height: '36px', borderRadius: '50%',
                                    backgroundColor: '#EDE9F6', color: 'var(--pk-primary)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '13px', fontWeight: 600
                                }}>{getInitials(staff.name)}</div>
                                <div>
                                    <span style={{ fontSize: '14px', fontWeight: 500, display: 'block' }}>{staff.name}</span>
                                    {staff.email && <span style={{ fontSize: '12px', color: '#9CA3AF' }}>{staff.email}</span>}
                                </div>
                            </div>
                            <button onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveStaff(staff.id);
                            }} style={{
                                background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF',
                                padding: '4px', borderRadius: '4px', transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.backgroundColor = '#FEF2F2'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                                <X size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AssignedGroupsTab;
