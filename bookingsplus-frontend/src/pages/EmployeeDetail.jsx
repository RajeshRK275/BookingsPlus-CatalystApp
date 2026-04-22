import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Share2, Trash2, ArrowLeft, Pencil, Plus, Check, X } from 'lucide-react';
import { Button } from '../ui/Button';
import axios from 'axios';
import { useWorkspace } from '../contexts/WorkspaceContext';

const EmployeeDetail = () => {
    const { employeeId } = useParams();
    const navigate = useNavigate();
    const { activeWorkspace } = useWorkspace();
    const wsSlug = activeWorkspace?.workspace_slug || '';
    const [activeTab, setActiveTab] = useState('Profile');
    const [assignedServices, setAssignedServices] = useState([]);
    
    // Employee Data State
    const [emp, setEmp] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchEmployee = async () => {
            try {
                const response = await axios.get('/server/bookingsplus/api/v1/users');
                
                if (response.data && response.data.success) {
                    const found = response.data.data.find(e => String(e.id || e.user_id) === String(employeeId));
                    if (found) {
                        setEmp(found);
                        setEditForm(found);
                    }
                }
            } catch (err) {
                console.error('Error fetching employee from Catalyst:', err);
                // Fallback for UI visualization
                const fallbackEmps = JSON.parse(localStorage.getItem('bp_employees') || '[]');
                const found = fallbackEmps.find(e => String(e.id) === String(employeeId));
                if (found) {
                    setEmp(found);
                    setEditForm(found);
                }
            } finally {
                setLoading(false);
            }
        };

        const fetchServices = async () => {
            try {
                const response = await axios.get('/server/bookingsplus/api/v1/services');
                
                if (response.data && response.data.success) {
                    const services = response.data.data;
                    const assigned = services.filter(s => {
                        // Advanced I/O data format parsing
                        return true; // Simplify for now pending ServiceStaff join logic in React
                    });
                    setAssignedServices(assigned);
                }
            } catch (err) {
                // Fallback
                const services = JSON.parse(localStorage.getItem('bp_services') || '[]');
                setAssignedServices(services);
            }
        };

        fetchEmployee();
        fetchServices();
    }, [employeeId]);

    const handleSave = async () => {
        try {
            const targetId = emp.id || emp.user_id;

            // Attempt Catalyst update
            await axios.put(`/server/bookingsplus/api/v1/users/${targetId}`, editForm);

            setEmp({ ...editForm });
            setIsEditing(false);
        } catch (err) {
            console.error('Error updating employee in Catalyst:', err);
            // Fallback for UI if Datastore strictly fails
            const fallbackEmps = JSON.parse(localStorage.getItem('bp_employees') || '[]');
            const idx = fallbackEmps.findIndex(e => String(e.id) === String(emp.id || emp.user_id));
            if (idx > -1) {
                fallbackEmps[idx] = { ...editForm };
                localStorage.setItem('bp_employees', JSON.stringify(fallbackEmps));
            }
            setEmp({ ...editForm });
            setIsEditing(false);
        }
    };

    if (loading) return <div style={{ padding: '24px' }}>Loading Employee...</div>;
    if (!emp) return <div style={{ padding: '24px' }}>Employee not found.</div>;

    const renderField = (label, key) => {
        if (isEditing) {
            return (
                <div>
                    <div style={{ fontSize: '12px', color: 'var(--pk-text-muted)', marginBottom: '6px' }}>{label}</div>
                    <input 
                        type="text" 
                        value={editForm[key] || ''} 
                        onChange={e => setEditForm({ ...editForm, [key]: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--pk-border)', borderRadius: '6px', fontSize: '14px' }} 
                    />
                </div>
            );
        }
        return (
            <div>
                <div style={{ fontSize: '12px', color: 'var(--pk-text-muted)', marginBottom: '6px' }}>{label}</div>
                <div style={{ fontSize: '14px', color: 'var(--pk-text-main)' }}>{emp[key] || '-'}</div>
            </div>
        );
    };

    return (
        <div className="page-container" style={{ padding: '24px', backgroundColor: 'white', height: 'calc(100vh - 60px)', overflowY: 'auto' }}>
            {/* Top Bar Navigation */}
            <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button onClick={() => navigate(`/ws/${wsSlug}/employees`)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                            <ArrowLeft size={18} color="var(--pk-text-main)" />
                        </button>
                        <h1 style={{ fontSize: '20px', fontWeight: 600 }}>{emp.name}</h1>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Button variant="outline" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Share2 size={14} /> Share
                        </Button>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', display: 'flex', alignItems: 'center', padding: '8px' }}>
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--pk-border)', gap: '24px' }}>
                    {['Profile', 'Availability', 'Assigned Services', 'Integrations'].map(tab => (
                        <div key={tab} onClick={() => setActiveTab(tab)} style={{
                            padding: '10px 4px', fontSize: '14px', fontWeight: activeTab === tab ? 600 : 500,
                            color: activeTab === tab ? 'var(--pk-primary)' : 'var(--pk-text-muted)',
                            borderBottom: activeTab === tab ? '2px solid var(--pk-primary)' : '2px solid transparent',
                            cursor: 'pointer'
                        }} >{tab}</div>
                    ))}
                </div>
            </div>

            {/* Profile Tab */}
            {activeTab === 'Profile' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Header Card */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '24px', borderBottom: '1px solid #F3F4F6' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: emp.color || '#E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>{emp.initials || '👤'}</div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                    <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>{emp.name}</h2>
                                    <span style={{ backgroundColor: '#F3F4F6', color: 'var(--pk-text-muted)', fontSize: '11px', padding: '2px 8px', borderRadius: '12px', fontWeight: 500 }}>{emp.role}</span>
                                </div>
                                <div style={{ fontSize: '13px', color: 'var(--pk-text-muted)' }}>{emp.email}</div>
                            </div>
                        </div>
                        
                        {isEditing ? (
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <Button variant="outline" onClick={() => { setIsEditing(false); setEditForm(emp); }} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <X size={14} /> Cancel
                                </Button>
                                <Button variant="primary" onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Check size={14} /> Save
                                </Button>
                            </div>
                        ) : (
                            <Button variant="outline" onClick={() => setIsEditing(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Pencil size={14} /> Edit
                            </Button>
                        )}
                        
                    </div>

                    <div style={{ maxWidth: '800px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '24px', color: '#111827' }}>Personal Information</h3>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px 64px' }}>
                            {renderField('Name', 'name')}
                            {renderField('Email', 'email')}
                            {renderField('Phone Number', 'phone')}
                            {renderField('Role', 'role')}
                            {renderField('Designation', 'designation')}
                            {renderField('Gender', 'gender')}
                            {renderField('Date of Birth', 'dob')}
                            
                            <div>
                                <div style={{ fontSize: '12px', color: 'var(--pk-text-muted)', marginBottom: '6px' }}>Status</div>
                                <div style={{ display: 'inline-block', backgroundColor: '#DCFCE7', color: '#166534', fontSize: '12px', padding: '2px 10px', borderRadius: '4px', fontWeight: 500 }}>Active</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '12px', color: 'var(--pk-text-muted)', marginBottom: '6px' }}>Organization</div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <div style={{ backgroundColor: '#C4B5FD', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', color: '#4C1D95', fontWeight: 600 }}>B+</div>
                                    <div style={{ backgroundColor: '#F3F4F6', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', color: 'var(--pk-text-main)', fontWeight: 500 }}>Bookings+</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Availability Tab */}
            {activeTab === 'Availability' && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', borderBottom: '1px solid #F3F4F6', marginBottom: '24px', gap: '20px' }}>
                        {['Default Hours', 'Custom Schedules', 'Date Overrides'].map(sub => (
                            <div key={sub} style={{ padding: '8px 0', fontSize: '13px', fontWeight: sub === 'Default Hours' ? 600 : 500, color: sub === 'Default Hours' ? 'var(--pk-primary)' : 'var(--pk-text-muted)', borderBottom: sub === 'Default Hours' ? '2px solid var(--pk-primary)' : 'none', cursor: 'pointer' }}>{sub}</div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', padding: '12px 16px', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                            <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#4F46E5', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}>!</div>
                            <span>{emp.name} follows business hours.</span>
                        </div>
                        <Button variant="outline" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Pencil size={14}/> Customize</Button>
                    </div>

                    <div style={{ display: 'flex', gap: '48px' }}>
                        <div style={{ flex: 2 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', marginBottom: '24px' }}>
                                <div>
                                    <div style={{ fontSize: '12px', color: 'var(--pk-text-muted)', marginBottom: '4px' }}>Date Range</div>
                                    <div style={{ fontSize: '14px' }}>Forever</div>
                                </div>
                                <div style={{ paddingLeft: '48px'}}>
                                    <div style={{ fontSize: '12px', color: 'var(--pk-text-muted)', marginBottom: '4px' }}>Time Zone</div>
                                    <div style={{ fontSize: '14px' }}>Asia/Kolkata</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => (
                                    <div key={day} style={{ display: 'grid', gridTemplateColumns: '150px 1fr', padding: '16px 0', borderBottom: '1px solid #F3F4F6' }}>
                                        <span style={{ fontSize: '14px', color: 'var(--pk-text-main)' }}>{day}</span>
                                        <span style={{ fontSize: '14px', color: 'var(--pk-text-main)' }}>09:00 am &nbsp; – &nbsp; 06:00 pm</span>
                                    </div>
                                ))}
                                <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', padding: '16px 0', borderBottom: '1px solid #F3F4F6' }}>
                                    <span style={{ fontSize: '14px', color: 'var(--pk-text-main)' }}>Saturday</span>
                                    <span style={{ fontSize: '14px', color: '#EF4444' }}>Not Available</span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', padding: '16px 0' }}>
                                    <span style={{ fontSize: '14px', color: 'var(--pk-text-main)' }}>Sunday</span>
                                    <span style={{ fontSize: '14px', color: '#EF4444' }}>Not Available</span>
                                </div>
                            </div>
                        </div>

                        <div style={{ flex: 1, paddingLeft: '48px'}}>
                            <h4 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Assigned Services</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {assignedServices.slice(0, 3).map(service => (
                                    <div key={service.id || service.service_id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ backgroundColor: '#C4B5FD', color: '#4C1D95', padding: '4px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, width: '28px', textAlign: 'center' }}>{(service.name || '').slice(0,2).toUpperCase()}</div>
                                        <span style={{ fontSize: '14px', fontWeight: 500 }}>{service.name}</span>
                                    </div>
                                ))}
                                {assignedServices.length > 3 && (
                                    <div style={{ backgroundColor: '#F3F4F6', color: 'var(--pk-text-muted)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, width: 'fit-content', marginTop: '8px' }}>
                                        +{assignedServices.length - 3} more
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Assigned Services Tab */}
            {activeTab === 'Assigned Services' && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Assigned Services</h2>
                            <span style={{ backgroundColor: '#F3F4F6', color: 'var(--pk-text-muted)', fontSize: '12px', padding: '2px 8px', borderRadius: '12px', fontWeight: 500 }}>{assignedServices.length}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <input type="text" placeholder="Search" className="input" style={{ width: '200px' }} />
                            <Button variant="outline" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={14}/> Assign</Button>
                        </div>
                    </div>

                    <div style={{ border: '1px solid var(--pk-border)', borderRadius: '8px', overflow: 'hidden' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 0.5fr', padding: '12px 24px', backgroundColor: '#F8FAFC', borderBottom: '1px solid var(--pk-border)', fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>
                            <span>Event Type Name</span>
                            <span>Type</span>
                            <span>Duration</span>
                            <span>Price</span>
                            <span></span>
                        </div>
                        {assignedServices.map(service => (
                            <div key={service.id || service.service_id} 
                                onClick={() => navigate(`/ws/${wsSlug}/services/${service.id || service.service_id}`)}
                                style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 0.5fr', padding: '16px 24px', borderBottom: '1px solid #F3F4F6', alignItems: 'center', cursor: 'pointer', backgroundColor: 'white', transition: 'background-color 0.15s' }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#FAFAFA'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ backgroundColor: '#C4B5FD', color: '#4C1D95', width: '32px', height: '32px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600 }}>{(service.name || '').slice(0,2).toUpperCase()}</div>
                                    <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--pk-text-main)' }}>{service.name}</span>
                                </div>
                                <div style={{ fontSize: '13px', color: 'var(--pk-text-main)' }}>{service.service_type === 'group' || service.type === 'group' ? 'Group Booking' : 'One-on-One'}</div>
                                <div style={{ fontSize: '13px', color: 'var(--pk-text-main)' }}>{(service.duration_minutes || service.duration || 60) >= 60 ? `${Math.floor((service.duration_minutes || service.duration || 60)/60)} Hour${(service.duration_minutes || service.duration || 60)%60 > 0 ? ` ${(service.duration_minutes || service.duration || 60)%60} mins` : ''}` : `${service.duration_minutes || service.duration || 60} mins`}</div>
                                <div style={{ fontSize: '13px', color: 'var(--pk-text-main)' }}>${service.price}</div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pk-text-muted)' }}>•••</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmployeeDetail;
