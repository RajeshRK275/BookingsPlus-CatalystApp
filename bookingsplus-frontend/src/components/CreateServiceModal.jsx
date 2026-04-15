import React, { useState } from 'react';
import { X, User, Users, UsersRound, Monitor, Search } from 'lucide-react';
import { Button } from '../ui/Button';
import axios from 'axios';

const SERVICE_TYPES = [
    {
        id: 'one-on-one',
        title: 'One-on-One',
        description: 'Ideal for support calls, client meetings, and any one-to-one meetings',
        icon: User,
        tags: ['One Time', 'Recurring']
    },
    {
        id: 'group',
        title: 'Group Booking',
        description: 'Ideal for workshops, webinars, and classes',
        icon: Users,
        tags: ['One Time', 'Recurring']
    },
    {
        id: 'collective',
        title: 'Collective Booking',
        description: 'Ideal for panel interviews, board meetings, and any many-to-one meetings',
        icon: UsersRound,
        tags: []
    },
    {
        id: 'resource',
        title: 'Resource',
        description: 'Ideal for conference room bookings and equipment rentals',
        icon: Monitor,
        tags: []
    }
];

// Mock staff data (would come from /api/v1/users in production)
const MOCK_STAFF = [
    { id: 1, name: 'Jason Miller' },
    { id: 2, name: 'Emily Carter' },
    { id: 3, name: 'Michael Thompson' },
    { id: 4, name: 'Sarah Johnson' },
    { id: 5, name: 'David Wilson' }
];

export const CreateServiceModal = ({ isOpen, onClose, onServiceCreated }) => {
    const [step, setStep] = useState(1);
    const [serviceType, setServiceType] = useState(null);
    const [isCreating, setIsCreating] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        durationHours: '0 Hours',
        durationMinutes: '30 Minutes',
        priceType: 'Paid',
        priceValue: '0',
        meetingMode: 'Online',
        meetingLocation: 'Zoho Meeting',
        seats: '1'
    });

    // Staff Assignment State
    const [selectedStaff, setSelectedStaff] = useState([]);
    const [staffSearch, setStaffSearch] = useState('');
    const [hoveredStaff, setHoveredStaff] = useState(null);

    if (!isOpen) return null;

    const handleSelectType = (id) => {
        setServiceType(id);
        setStep(2);
    };

    const handleBack = () => {
        if (step === 3) {
            setStep(2);
        } else {
            setStep(1);
            setServiceType(null);
        }
    };

    const handleNext = () => {
        setStep(3);
    };

    const handleOverlayClick = (e) => {
        if (e.target.className && typeof e.target.className === 'string' && e.target.className.includes('modal-overlay')) onClose();
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const toggleStaff = (staffId) => {
        setSelectedStaff(prev =>
            prev.includes(staffId)
                ? prev.filter(id => id !== staffId)
                : [...prev, staffId]
        );
    };

    const toggleSelectAll = () => {
        const filteredIds = filteredStaff.map(s => s.id);
        const allSelected = filteredIds.every(id => selectedStaff.includes(id));
        if (allSelected) {
            setSelectedStaff(prev => prev.filter(id => !filteredIds.includes(id)));
        } else {
            setSelectedStaff(prev => [...new Set([...prev, ...filteredIds])]);
        }
    };

    const filteredStaff = MOCK_STAFF.filter(s =>
        s.name.toLowerCase().includes(staffSearch.toLowerCase())
    );

    const getInitials = (name) => {
        return name.split(' ').map(w => w[0]).join('').toUpperCase();
    };

    const handleCreateService = async () => {
        setIsCreating(true);
        try {
            // Calculate duration in minutes
            const hours = parseInt(formData.durationHours) || 0;
            const minutes = parseInt(formData.durationMinutes) || 0;
            const durationMinutes = hours * 60 + minutes;

            const payload = {
                name: formData.name,
                duration_minutes: durationMinutes,
                price: formData.priceType === 'Free' ? 0 : parseFloat(formData.priceValue) || 0,
                service_type: serviceType,
                meeting_mode: formData.meetingMode,
                meeting_location: formData.meetingLocation,
                seats: parseInt(formData.seats) || 1,
                staff_ids: selectedStaff
            };

            const token = localStorage.getItem('token');
            const response = await axios.post('/server/bookingsplus/api/v1/services', payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success && onServiceCreated) {
                onServiceCreated({
                    id: response.data.data?.service_id || Date.now(),
                    name: formData.name,
                    duration: durationMinutes,
                    price: formData.priceType === 'Free' ? '$0.00' : `$${parseFloat(formData.priceValue || 0).toFixed(2)}`,
                    status: 'active',
                    type: serviceType,
                    staffCount: selectedStaff.length
                });
            }
        } catch (err) {
            console.error('Service creation failed:', err);
            // Fallback: still add locally for demo purposes
            if (onServiceCreated) {
                const hours = parseInt(formData.durationHours) || 0;
                const minutes = parseInt(formData.durationMinutes) || 0;
                onServiceCreated({
                    id: Date.now(),
                    name: formData.name,
                    duration: hours * 60 + minutes,
                    price: formData.priceType === 'Free' ? '$0.00' : `$${parseFloat(formData.priceValue || 0).toFixed(2)}`,
                    status: 'active',
                    type: serviceType,
                    staffCount: selectedStaff.length
                });
            }
        } finally {
            setIsCreating(false);
            // Reset state
            setStep(1);
            setServiceType(null);
            setFormData({
                name: '', durationHours: '0 Hours', durationMinutes: '30 Minutes',
                priceType: 'Paid', priceValue: '0', meetingMode: 'Online',
                meetingLocation: 'Zoho Meeting', seats: '1'
            });
            setSelectedStaff([]);
            setStaffSearch('');
            onClose();
        }
    };

    const renderStep1 = () => (
        <div className="modal-content-inner" style={{ padding: '40px 32px', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 600 }}>Create New Service</h2>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {SERVICE_TYPES.map((type) => {
                    const Icon = type.icon;
                    return (
                        <div 
                            key={type.id}
                            className="service-type-card"
                            onClick={() => handleSelectType(type.id)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '24px',
                                padding: '24px',
                                backgroundColor: 'white',
                                borderRadius: '12px',
                                border: '1px solid var(--pk-border)',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            <div style={{ 
                                width: '64px', height: '64px', borderRadius: '12px', 
                                backgroundColor: '#F3F0FF', color: 'var(--pk-primary)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0
                            }}>
                                <Icon size={32} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <h3 style={{ fontSize: '16px', margin: 0 }}>{type.title}</h3>
                                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '1px solid #D1D5DB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: '10px' }}>i</div>
                                </div>
                                <p style={{ color: 'var(--pk-text-muted)', margin: 0, fontSize: '13px' }}>{type.description}</p>
                                {type.tags.length > 0 && (
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                        {type.tags.map(tag => (
                                            <span key={tag} style={{ 
                                                padding: '4px 12px', borderRadius: '4px', border: '1px solid var(--pk-border)', 
                                                fontSize: '11px', color: 'var(--pk-primary)', fontWeight: 500
                                            }}>
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    const renderFormFields = () => {
        const isResource = serviceType === 'resource';
        const isGroup = serviceType === 'group';
        
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div className="form-group">
                    <label>Service Name *</label>
                    <input 
                        className="input" 
                        name="name" 
                        value={formData.name} 
                        onChange={handleChange} 
                        placeholder="" 
                    />
                </div>

                {!isResource && (
                    <div className="form-group">
                        <label>Duration</label>
                        <div style={{ display: 'flex', gap: '16px' }}>
                            <select className="input" name="durationHours" value={formData.durationHours} onChange={handleChange}>
                                {[0, 1, 2, 3, 4, 5].map(h => <option key={h} value={`${h} Hours`}>{`${h} Hours`}</option>)}
                            </select>
                            <select className="input" name="durationMinutes" value={formData.durationMinutes} onChange={handleChange}>
                                {[0, 15, 30, 45].map(m => <option key={m} value={`${m} Minutes`}>{`${m} Minutes`}</option>)}
                            </select>
                        </div>
                    </div>
                )}

                <div className="form-group">
                    <label>Price</label>
                    <div style={{ display: 'flex', gap: '16px' }}>
                        {!isResource && (
                            <div style={{ display: 'flex', borderRadius: '6px', border: '1px solid var(--pk-border)', overflow: 'hidden' }}>
                                <div 
                                    onClick={() => setFormData({...formData, priceType: 'Free'})}
                                    style={{ 
                                        padding: '8px 24px', cursor: 'pointer', fontSize: '14px',
                                        backgroundColor: formData.priceType === 'Free' ? '#F3F0FF' : 'white',
                                        color: formData.priceType === 'Free' ? 'var(--pk-primary)' : 'var(--pk-text-muted)',
                                        borderRight: '1px solid var(--pk-border)'
                                    }}
                                >Free</div>
                                <div 
                                    onClick={() => setFormData({...formData, priceType: 'Paid'})}
                                    style={{ 
                                        padding: '8px 24px', cursor: 'pointer', fontSize: '14px',
                                        backgroundColor: formData.priceType === 'Paid' ? 'white' : '#F9FAFB',
                                        color: formData.priceType === 'Paid' ? 'var(--pk-text-main)' : 'var(--pk-text-muted)'
                                    }}
                                >Paid</div>
                            </div>
                        )}
                        {(formData.priceType === 'Paid' || isResource) && (
                            <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
                                <div style={{ 
                                    padding: '8px 12px', background: '#F9FAFB', border: '1px solid var(--pk-border)', 
                                    borderRight: 'none', borderRadius: '4px 0 0 4px', color: 'var(--pk-text-muted)',
                                    display: 'flex', alignItems: 'center', borderRight: '1px solid var(--pk-border)'
                                }}>$</div>
                                <input 
                                    className="input" 
                                    style={{ borderRadius: '0 4px 4px 0', borderLeft: 'none' }} 
                                    name="priceValue" 
                                    value={formData.priceValue} 
                                    onChange={handleChange} 
                                />
                            </div>
                        )}
                    </div>
                </div>

                {isResource && (
                    <div className="form-group">
                        <label>Priced For</label>
                        <div style={{ display: 'flex', gap: '16px' }}>
                            <select className="input" name="durationHours" value={formData.durationHours} onChange={handleChange}>
                                {[0, 1, 2, 3, 4, 5].map(h => <option key={h} value={`${h} Hours`}>{`${h} Hours`}</option>)}
                            </select>
                            <select className="input" name="durationMinutes" value={formData.durationMinutes} onChange={handleChange}>
                                {[0, 15, 30, 45].map(m => <option key={m} value={`${m} Minutes`}>{`${m} Minutes`}</option>)}
                            </select>
                        </div>
                    </div>
                )}

                {isGroup && (
                    <div className="form-group">
                        <label>No of Seats</label>
                        <input 
                            className="input" 
                            name="seats" 
                            value={formData.seats} 
                            onChange={handleChange} 
                            type="number"
                        />
                    </div>
                )}

                {!isResource && (
                    <div className="form-group">
                        <label>Meeting Mode</label>
                        <div style={{ display: 'flex', gap: '16px' }}>
                            <div style={{ display: 'flex', borderRadius: '6px', border: '1px solid var(--pk-border)', overflow: 'hidden' }}>
                                <div 
                                    onClick={() => setFormData({...formData, meetingMode: 'Online'})}
                                    style={{ 
                                        padding: '8px 16px', cursor: 'pointer', fontSize: '14px',
                                        backgroundColor: formData.meetingMode === 'Online' ? '#F3F0FF' : 'white',
                                        color: formData.meetingMode === 'Online' ? 'var(--pk-primary)' : 'var(--pk-text-muted)',
                                        borderRight: '1px solid var(--pk-border)'
                                    }}
                                >Online</div>
                                <div 
                                    onClick={() => setFormData({...formData, meetingMode: 'Offline'})}
                                    style={{ 
                                        padding: '8px 16px', cursor: 'pointer', fontSize: '14px',
                                        backgroundColor: formData.meetingMode === 'Offline' ? 'white' : '#F9FAFB',
                                        color: formData.meetingMode === 'Offline' ? 'var(--pk-text-main)' : 'var(--pk-text-muted)'
                                    }}
                                >Offline</div>
                            </div>
                            <select className="input" name="meetingLocation" value={formData.meetingLocation} onChange={handleChange} style={{ flex: 1 }}>
                                {formData.meetingMode === 'Online' ? (
                                    <option value="Zoho Meeting">Zoho Meeting</option>
                                ) : (
                                    <option value="HQ Office">HQ Office</option>
                                )}
                            </select>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderStep2 = () => {
        const typeInfo = SERVICE_TYPES.find(t => t.id === serviceType);
        const Icon = typeInfo?.icon || User;

        return (
            <div className="modal-content-inner" style={{ 
                maxWidth: '560px', margin: '60px auto', display: 'flex', flexDirection: 'column', gap: '24px'
            }}>

                {/* Header Card */}
                <div style={{ 
                    backgroundColor: 'white', padding: '20px 24px', borderRadius: '8px', 
                    border: '1px solid var(--pk-border)', display: 'flex', alignItems: 'center', gap: '16px'
                }}>
                    <div style={{ 
                        width: '56px', height: '56px', borderRadius: '12px', 
                        backgroundColor: '#C4B5FD', color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <Icon size={28} />
                    </div>
                    <div>
                        <div style={{ color: 'var(--pk-text-muted)', fontSize: '13px', marginBottom: '4px' }}>Service title</div>
                        <div style={{ fontSize: '16px', fontWeight: 500, color: 'var(--pk-text-main)' }}>{typeInfo?.title}</div>
                    </div>
                </div>

                {/* Details Form Card */}
                <div style={{ 
                    backgroundColor: 'white', borderRadius: '8px', border: '1px solid var(--pk-border)', overflow: 'hidden'
                }}>
                    <div style={{ 
                        padding: '16px 24px', borderBottom: '1px solid var(--pk-border)',
                        fontSize: '13px', fontWeight: 600, color: '#374151', 
                        borderLeft: '3px solid var(--pk-primary)', textTransform: 'uppercase', letterSpacing: '0.05em'
                    }}>
                        Service Details
                    </div>
                    
                    <div style={{ padding: '24px' }}>
                        {renderFormFields()}
                    </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                    <Button variant="secondary" onClick={handleBack} style={{ padding: '10px 32px' }}>
                        Back
                    </Button>
                    <Button variant="primary" style={{ padding: '10px 48px' }} onClick={handleNext}>
                        Next
                    </Button>
                </div>
            </div>
        );
    };

    const renderStep3 = () => {
        const typeInfo = SERVICE_TYPES.find(t => t.id === serviceType);
        const Icon = typeInfo?.icon || User;
        const allFilteredSelected = filteredStaff.length > 0 && filteredStaff.every(s => selectedStaff.includes(s.id));
        const assignedStaffList = MOCK_STAFF.filter(s => selectedStaff.includes(s.id));

        return (
            <div className="modal-content-inner" style={{
                maxWidth: '560px', margin: '60px auto', display: 'flex', flexDirection: 'column', gap: '24px'
            }}>
                {/* Header Card — shows service name + type */}
                <div style={{
                    backgroundColor: 'white', padding: '20px 24px', borderRadius: '8px',
                    border: '1px solid var(--pk-border)', display: 'flex', alignItems: 'center', gap: '16px'
                }}>
                    <div style={{
                        width: '56px', height: '56px', borderRadius: '12px',
                        backgroundColor: '#C4B5FD', color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <Icon size={28} />
                    </div>
                    <div>
                        <div style={{ fontSize: '16px', fontWeight: 500, color: 'var(--pk-text-main)' }}>
                            {formData.name || 'Untitled Service'}
                        </div>
                        <div style={{ color: 'var(--pk-text-muted)', fontSize: '13px', marginTop: '2px' }}>
                            {typeInfo?.title}
                        </div>
                    </div>
                </div>

                {/* Assign Employees Card */}
                <div style={{
                    backgroundColor: 'white', borderRadius: '8px', border: '1px solid var(--pk-border)',
                    overflow: 'hidden', display: 'flex', flexDirection: 'column'
                }}>
                    {/* Section Header */}
                    <div style={{
                        padding: '16px 24px', borderBottom: '1px solid var(--pk-border)',
                        fontSize: '13px', fontWeight: 600, color: '#374151',
                        borderLeft: '3px solid var(--pk-primary)', textTransform: 'uppercase', letterSpacing: '0.05em'
                    }}>
                        Assign Employees
                    </div>

                    {/* Search + Select All */}
                    <div style={{
                        padding: '16px 24px', display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between', borderBottom: '1px solid var(--pk-border)'
                    }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            border: '1px solid var(--pk-border)', borderRadius: '6px',
                            padding: '8px 12px', flex: '0 1 280px', backgroundColor: '#FAFAFA'
                        }}>
                            <Search size={16} color="#9CA3AF" />
                            <input
                                type="text"
                                placeholder="Search Employees"
                                value={staffSearch}
                                onChange={(e) => setStaffSearch(e.target.value)}
                                style={{
                                    border: 'none', outline: 'none', fontSize: '14px',
                                    backgroundColor: 'transparent', width: '100%',
                                    color: 'var(--pk-text-main)'
                                }}
                            />
                        </div>
                        <label style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            cursor: 'pointer', fontSize: '14px', color: 'var(--pk-text-main)',
                            userSelect: 'none'
                        }}>
                            Select All
                            <input
                                type="checkbox"
                                checked={allFilteredSelected}
                                onChange={toggleSelectAll}
                                style={{
                                    width: '18px', height: '18px', accentColor: 'var(--pk-primary)',
                                    cursor: 'pointer'
                                }}
                            />
                        </label>
                    </div>

                    {/* Staff List */}
                    <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                        {filteredStaff.length === 0 ? (
                            <div style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--pk-text-muted)', fontSize: '14px' }}>
                                No employees found
                            </div>
                        ) : (
                            filteredStaff.map(staff => {
                                const isSelected = selectedStaff.includes(staff.id);
                                return (
                                    <div
                                        key={staff.id}
                                        onClick={() => toggleStaff(staff.id)}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            padding: '14px 24px', cursor: 'pointer',
                                            borderBottom: '1px solid #F3F4F6',
                                            transition: 'background-color 0.15s',
                                            backgroundColor: isSelected ? '#FAFAFF' : 'white'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isSelected ? '#F3F0FF' : '#F9FAFB'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isSelected ? '#FAFAFF' : 'white'}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                            <div style={{
                                                width: '40px', height: '40px', borderRadius: '50%',
                                                backgroundColor: '#F3F4F6', color: '#9CA3AF',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '14px', fontWeight: 500
                                            }}>
                                                {getInitials(staff.name)}
                                            </div>
                                            <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--pk-text-main)' }}>
                                                {staff.name}
                                            </span>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            readOnly
                                            style={{
                                                width: '18px', height: '18px', accentColor: 'var(--pk-primary)',
                                                cursor: 'pointer', pointerEvents: 'none'
                                            }}
                                        />
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Employees Assigned Footer */}
                    <div style={{
                        padding: '14px 24px', borderTop: '1px solid var(--pk-border)',
                        display: 'flex', alignItems: 'center', gap: '12px',
                        backgroundColor: '#FAFAFA', minHeight: '52px'
                    }}>
                        <span style={{ fontSize: '13px', color: 'var(--pk-text-muted)', whiteSpace: 'nowrap' }}>
                            Employees Assigned:
                        </span>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {assignedStaffList.length === 0 ? (
                                <span style={{ fontSize: '13px', color: '#D1D5DB' }}>None selected</span>
                            ) : (
                                assignedStaffList.map(staff => (
                                    <div
                                        key={staff.id}
                                        style={{ position: 'relative' }}
                                        onMouseEnter={() => setHoveredStaff(staff.id)}
                                        onMouseLeave={() => setHoveredStaff(null)}
                                    >
                                        <div style={{
                                            width: '32px', height: '32px', borderRadius: '50%',
                                            backgroundColor: '#E5E7EB', color: '#6B7280',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '11px', fontWeight: 600, cursor: 'default',
                                            border: '2px solid white'
                                        }}>
                                            {getInitials(staff.name)}
                                        </div>
                                        {/* Tooltip */}
                                        {hoveredStaff === staff.id && (
                                            <div style={{
                                                position: 'absolute', bottom: '100%', left: '50%',
                                                transform: 'translateX(-50%)', marginBottom: '6px',
                                                backgroundColor: '#374151', color: 'white',
                                                padding: '4px 10px', borderRadius: '4px',
                                                fontSize: '12px', whiteSpace: 'nowrap', zIndex: 10,
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                                            }}>
                                                {staff.name}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                    <Button variant="secondary" onClick={handleBack} style={{ padding: '10px 32px' }}>
                        Back
                    </Button>
                    <Button
                        variant="primary"
                        style={{ padding: '10px 48px' }}
                        onClick={handleCreateService}
                        disabled={isCreating}
                    >
                        {isCreating ? 'Creating...' : 'Create Service'}
                    </Button>
                </div>
            </div>
        );
    };

    const renderCurrentStep = () => {
        switch (step) {
            case 1: return renderStep1();
            case 2: return renderStep2();
            case 3: return renderStep3();
            default: return renderStep1();
        }
    };

    return (
        <div 
            className="modal-overlay" 
            onClick={handleOverlayClick}
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: '#F3F4F6',
                zIndex: 1000,
                overflowY: 'auto'
            }}
        >
            <button onClick={onClose} style={{ position: 'fixed', right: '32px', top: '32px', background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', zIndex: 1001 }}>
                <X size={24} />
            </button>
            {renderCurrentStep()}
        </div>
    );
};
