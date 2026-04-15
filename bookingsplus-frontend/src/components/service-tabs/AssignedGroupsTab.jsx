import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '../../ui/Button';

const MOCK_STAFF = [
    { id: 1, name: 'Jason Miller' },
    { id: 2, name: 'Emily Carter' },
    { id: 3, name: 'Michael Thompson' },
    { id: 4, name: 'Sarah Johnson' },
    { id: 5, name: 'David Wilson' }
];

const getInitials = (name) => name.split(' ').map(w => w[0]).join('').toUpperCase();

const AssignedGroupsTab = ({ service, onUpdate }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState(service.assignedStaff || []);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredStaff = MOCK_STAFF.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const toggleStaff = (staffId) => {
        setSelectedStaff(prev =>
            prev.includes(staffId) ? prev.filter(id => id !== staffId) : [...prev, staffId]
        );
    };

    const handleSave = () => {
        onUpdate({ ...service, assignedStaff: selectedStaff });
        setIsEditing(false);
    };

    const handleCancel = () => {
        setSelectedStaff(service.assignedStaff || []);
        setIsEditing(false);
    };

    const assignedStaffList = MOCK_STAFF.filter(s => selectedStaff.includes(s.id));

    if (isEditing) {
        return (
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Manage Staff Assignments</h3>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <Button variant="primary" onClick={handleSave}>Save</Button>
                        <Button variant="secondary" onClick={handleCancel}>Cancel</Button>
                    </div>
                </div>

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
                    {filteredStaff.map(staff => {
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
                                        backgroundColor: '#F3F4F6', color: '#9CA3AF',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '13px', fontWeight: 500
                                    }}>{getInitials(staff.name)}</div>
                                    <span style={{ fontSize: '14px', fontWeight: 500 }}>{staff.name}</span>
                                </div>
                                <input type="checkbox" checked={isSelected} readOnly
                                    style={{ width: '18px', height: '18px', accentColor: 'var(--pk-primary)', pointerEvents: 'none' }} />
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    // View mode
    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Assigned Staff</h3>
                <Button variant="secondary" onClick={() => setIsEditing(true)}>✏️ Edit</Button>
            </div>

            {assignedStaffList.length === 0 ? (
                <div style={{
                    padding: '48px', textAlign: 'center', border: '1px dashed var(--pk-border)',
                    borderRadius: '8px', color: 'var(--pk-text-muted)'
                }}>
                    <p style={{ fontSize: '14px', marginBottom: '12px' }}>No staff assigned to this service yet.</p>
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
                                <span style={{ fontSize: '14px', fontWeight: 500 }}>{staff.name}</span>
                            </div>
                            <button onClick={(e) => {
                                e.stopPropagation();
                                const updated = selectedStaff.filter(id => id !== staff.id);
                                setSelectedStaff(updated);
                                onUpdate({ ...service, assignedStaff: updated });
                            }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: '4px' }}>
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
