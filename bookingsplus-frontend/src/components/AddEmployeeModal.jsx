import React, { useState, useEffect } from 'react';
import { X, UserPlus, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { usersApi } from '../services';
import api from '../services/api';
import { useWorkspace } from '../contexts/WorkspaceContext';

/**
 * AddEmployeeModal — Production-grade modal for inviting/adding employees.
 * Fetches workspace roles from the backend to show in the role dropdown.
 * Calls POST /users to provision user in Catalyst + assign to workspace.
 */
const AddEmployeeModal = ({ isOpen, onClose, onEmployeeAdded }) => {
    const { activeWorkspace } = useWorkspace();
    const [roles, setRoles] = useState([]);
    const [rolesLoading, setRolesLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        designation: '',
        gender: '',
        role_id: '',
    });

    // Fetch workspace roles when modal opens
    useEffect(() => {
        if (!isOpen) return;

        // Reset state
        setFormData({ name: '', email: '', phone: '', designation: '', gender: '', role_id: '' });
        setError('');
        setSuccess('');
        setSubmitting(false);

        const fetchRoles = async () => {
            setRolesLoading(true);
            try {
                const wsId = activeWorkspace?.workspace_id;
                if (!wsId) return;
                const res = await api.get(`/admin/roles/${wsId}/roles`);
                if (res.data?.success) {
                    const allRoles = res.data.data || [];
                    // Sort by role_level descending (Admin first, then Manager, Staff)
                    allRoles.sort((a, b) => (parseInt(b.role_level) || 0) - (parseInt(a.role_level) || 0));
                    setRoles(allRoles);
                    // Pre-select "Staff" role
                    const staffRole = allRoles.find(r => r.role_name === 'Staff');
                    if (staffRole) {
                        setFormData(prev => ({ ...prev, role_id: staffRole.id || staffRole.ROWID }));
                    }
                }
            } catch (err) {
                console.error('Error fetching roles:', err.message || err);
                // Fallback: allow submission without role_id (backend defaults to Staff)
            } finally {
                setRolesLoading(false);
            }
        };

        fetchRoles();
    }, [isOpen, activeWorkspace]);

    if (!isOpen) return null;

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (error) setError('');
    };

    const validateForm = () => {
        if (!formData.name.trim()) return 'Name is required.';
        if (!formData.email.trim()) return 'Email is required.';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email.trim())) return 'Please enter a valid email address.';
        return null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        const validationError = validateForm();
        if (validationError) {
            setError(validationError);
            return;
        }

        setSubmitting(true);

        try {
            const payload = {
                name: formData.name.trim(),
                display_name: formData.name.trim(),
                email: formData.email.trim().toLowerCase(),
                phone: formData.phone.trim(),
                designation: formData.designation.trim(),
                gender: formData.gender,
            };

            if (formData.role_id) {
                payload.role_id = formData.role_id;
            }

            const res = await usersApi.create(payload);

            if (res.data?.success) {
                setSuccess(`${formData.name} has been invited successfully! They'll receive a login email.`);
                
                if (onEmployeeAdded) {
                    onEmployeeAdded(res.data.data);
                }

                // Close modal after a short delay to show success message
                setTimeout(() => {
                    onClose();
                }, 1500);
            } else {
                setError(res.data?.message || 'Failed to add employee. Please try again.');
            }
        } catch (err) {
            const msg = err?.response?.data?.message || err?.data?.message || err?.message || 'Failed to add employee.';
            if (msg.toLowerCase().includes('already a member')) {
                setError('This user is already a member of this workspace.');
            } else if (msg.toLowerCase().includes('external service')) {
                setError('Failed to provision user account. Please check the email and try again.');
            } else {
                setError(msg);
            }
        } finally {
            setSubmitting(false);
        }
    };

    const fieldStyle = {
        width: '100%',
        padding: '10px 14px',
        border: '1px solid #D1D5DB',
        borderRadius: '8px',
        fontSize: '14px',
        fontFamily: "'Inter', sans-serif",
        outline: 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        backgroundColor: 'white',
    };

    const labelStyle = {
        display: 'block',
        fontSize: '13px',
        fontWeight: 600,
        color: '#374151',
        marginBottom: '6px',
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            backdropFilter: 'blur(2px)',
        }}
            onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}
        >
            <div style={{
                backgroundColor: 'white', borderRadius: '16px', width: '520px', maxWidth: '95vw',
                maxHeight: '90vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
                animation: 'slideUp 0.2s ease-out',
            }}>
                {/* Header */}
                <div style={{
                    padding: '24px 28px 20px', borderBottom: '1px solid #F3F4F6',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#EEF2FF',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <UserPlus size={20} color="#4F46E5" />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', margin: 0 }}>Add Employee</h2>
                            <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>Invite a new staff member to your workspace</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={submitting}
                        style={{
                            background: 'none', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
                            padding: '8px', borderRadius: '8px', display: 'flex',
                        }}
                        onMouseEnter={(e) => { if (!submitting) e.currentTarget.style.backgroundColor = '#F3F4F6'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                        <X size={20} color="#9CA3AF" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} style={{ padding: '24px 28px', overflowY: 'auto', maxHeight: 'calc(90vh - 160px)' }}>
                    {/* Error Message */}
                    {error && (
                        <div style={{
                            display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 16px',
                            backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px',
                            marginBottom: '20px',
                        }}>
                            <AlertCircle size={18} color="#DC2626" style={{ flexShrink: 0, marginTop: '1px' }} />
                            <p style={{ fontSize: '13px', color: '#DC2626', margin: 0, lineHeight: '1.5' }}>{error}</p>
                        </div>
                    )}

                    {/* Success Message */}
                    {success && (
                        <div style={{
                            display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 16px',
                            backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px',
                            marginBottom: '20px',
                        }}>
                            <CheckCircle size={18} color="#16A34A" style={{ flexShrink: 0, marginTop: '1px' }} />
                            <p style={{ fontSize: '13px', color: '#16A34A', margin: 0, lineHeight: '1.5' }}>{success}</p>
                        </div>
                    )}

                    {/* Name & Email — Required */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div>
                            <label style={labelStyle}>Full Name <span style={{ color: '#EF4444' }}>*</span></label>
                            <input
                                type="text"
                                placeholder="John Doe"
                                value={formData.name}
                                onChange={(e) => handleChange('name', e.target.value)}
                                style={fieldStyle}
                                onFocus={(e) => { e.target.style.borderColor = '#A78BFA'; e.target.style.boxShadow = '0 0 0 3px rgba(167,139,250,0.15)'; }}
                                onBlur={(e) => { e.target.style.borderColor = '#D1D5DB'; e.target.style.boxShadow = 'none'; }}
                                disabled={submitting}
                                required
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Email Address <span style={{ color: '#EF4444' }}>*</span></label>
                            <input
                                type="email"
                                placeholder="john@company.com"
                                value={formData.email}
                                onChange={(e) => handleChange('email', e.target.value)}
                                style={fieldStyle}
                                onFocus={(e) => { e.target.style.borderColor = '#A78BFA'; e.target.style.boxShadow = '0 0 0 3px rgba(167,139,250,0.15)'; }}
                                onBlur={(e) => { e.target.style.borderColor = '#D1D5DB'; e.target.style.boxShadow = 'none'; }}
                                disabled={submitting}
                                required
                            />
                        </div>
                    </div>

                    {/* Phone & Designation */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div>
                            <label style={labelStyle}>Phone Number</label>
                            <input
                                type="tel"
                                placeholder="+1 (555) 123-4567"
                                value={formData.phone}
                                onChange={(e) => handleChange('phone', e.target.value)}
                                style={fieldStyle}
                                onFocus={(e) => { e.target.style.borderColor = '#A78BFA'; e.target.style.boxShadow = '0 0 0 3px rgba(167,139,250,0.15)'; }}
                                onBlur={(e) => { e.target.style.borderColor = '#D1D5DB'; e.target.style.boxShadow = 'none'; }}
                                disabled={submitting}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Designation</label>
                            <input
                                type="text"
                                placeholder="e.g. Senior Stylist"
                                value={formData.designation}
                                onChange={(e) => handleChange('designation', e.target.value)}
                                style={fieldStyle}
                                onFocus={(e) => { e.target.style.borderColor = '#A78BFA'; e.target.style.boxShadow = '0 0 0 3px rgba(167,139,250,0.15)'; }}
                                onBlur={(e) => { e.target.style.borderColor = '#D1D5DB'; e.target.style.boxShadow = 'none'; }}
                                disabled={submitting}
                            />
                        </div>
                    </div>

                    {/* Gender & Role */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                        <div>
                            <label style={labelStyle}>Gender</label>
                            <select
                                value={formData.gender}
                                onChange={(e) => handleChange('gender', e.target.value)}
                                style={{ ...fieldStyle, cursor: 'pointer', color: formData.gender ? '#111827' : '#9CA3AF' }}
                                disabled={submitting}
                            >
                                <option value="" style={{ color: '#9CA3AF' }}>Select Gender</option>
                                <option value="Male" style={{ color: '#111827' }}>Male</option>
                                <option value="Female" style={{ color: '#111827' }}>Female</option>
                                <option value="Non-binary" style={{ color: '#111827' }}>Non-binary</option>
                                <option value="Prefer not to say" style={{ color: '#111827' }}>Prefer not to say</option>
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Role</label>
                            {rolesLoading ? (
                                <div style={{ ...fieldStyle, display: 'flex', alignItems: 'center', gap: '8px', color: '#9CA3AF' }}>
                                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                                    Loading roles...
                                </div>
                            ) : (
                                <select
                                    value={formData.role_id}
                                    onChange={(e) => handleChange('role_id', e.target.value)}
                                    style={{ ...fieldStyle, cursor: 'pointer', color: formData.role_id ? '#111827' : '#9CA3AF' }}
                                    disabled={submitting}
                                >
                                    <option value="" style={{ color: '#9CA3AF' }}>Default (Staff)</option>
                                    {roles.map(role => (
                                        <option key={role.id || role.ROWID} value={role.id || role.ROWID} style={{ color: '#111827' }}>
                                            {role.role_name}{role.role_level ? ` (Level ${role.role_level})` : ''}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>

                    {/* Info Note */}
                    <div style={{
                        backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px',
                        padding: '14px 16px', marginBottom: '24px',
                    }}>
                        <p style={{ fontSize: '12px', color: '#64748B', margin: 0, lineHeight: '1.6' }}>
                            <strong>Note:</strong> An invitation email will be sent to the employee. They can use it to set up
                            their password and log in to the workspace. You can manage their role, availability, and assigned
                            services after they're added.
                        </p>
                    </div>

                    {/* Footer Actions */}
                    <div style={{
                        display: 'flex', justifyContent: 'flex-end', gap: '12px',
                        paddingTop: '16px', borderTop: '1px solid #F3F4F6',
                    }}>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={submitting}
                            style={{ padding: '10px 20px' }}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            disabled={submitting}
                            style={{
                                padding: '10px 24px',
                                display: 'flex', alignItems: 'center', gap: '8px',
                                opacity: submitting ? 0.7 : 1,
                            }}
                        >
                            {submitting ? (
                                <>
                                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                                    Sending Invite...
                                </>
                            ) : (
                                <>
                                    <UserPlus size={16} />
                                    Add & Invite
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddEmployeeModal;
