import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Users, Mail, Phone, MoreHorizontal, X, AlertCircle, CheckCircle, Loader2, UserPlus, Calendar } from 'lucide-react';
import { Button } from '../ui/Button';
import PermissionGate from '../components/PermissionGate';
import { customersApi, appointmentsApi } from '../services';

/** Deterministic color palette */
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

/* ──────────────────────────────────────────────────────── */
/* AddCustomerModal                                         */
/* ──────────────────────────────────────────────────────── */
const AddCustomerModal = ({ isOpen, onClose, onCustomerAdded }) => {
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [formData, setFormData] = useState({ name: '', email: '', phone: '', notes: '' });

    useEffect(() => {
        if (isOpen) {
            setFormData({ name: '', email: '', phone: '', notes: '' });
            setError('');
            setSuccess('');
            setSubmitting(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (error) setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!formData.name.trim() && !formData.email.trim()) {
            setError('Name or email is required.');
            return;
        }

        setSubmitting(true);
        try {
            const res = await customersApi.create({
                name: formData.name.trim(),
                email: formData.email.trim().toLowerCase(),
                phone: formData.phone.trim(),
                notes: formData.notes.trim(),
            });
            if (res.data?.success) {
                setSuccess(`${formData.name || formData.email} added successfully!`);
                if (onCustomerAdded) onCustomerAdded(res.data.data);
                setTimeout(() => onClose(), 1200);
            } else {
                setError(res.data?.message || 'Failed to add customer.');
            }
        } catch (err) {
            const msg = err?.response?.data?.message || err?.data?.message || err?.message || 'Failed to add customer.';
            setError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const fieldStyle = {
        width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB',
        borderRadius: '8px', fontSize: '14px', fontFamily: "'Inter', sans-serif",
        outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s', backgroundColor: 'white',
    };

    return (
        <div
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(2px)' }}
            onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}
        >
            <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '480px', maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
                {/* Header */}
                <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <UserPlus size={20} color="#4F46E5" />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', margin: 0 }}>Add Customer</h2>
                            <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>Add a new customer to your workspace</p>
                        </div>
                    </div>
                    <button onClick={onClose} disabled={submitting} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '8px', display: 'flex' }}>
                        <X size={20} color="#9CA3AF" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '24px 28px' }}>
                    {error && (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 16px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', marginBottom: '20px' }}>
                            <AlertCircle size={18} color="#DC2626" style={{ flexShrink: 0, marginTop: '1px' }} />
                            <p style={{ fontSize: '13px', color: '#DC2626', margin: 0 }}>{error}</p>
                        </div>
                    )}
                    {success && (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 16px', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px', marginBottom: '20px' }}>
                            <CheckCircle size={18} color="#16A34A" style={{ flexShrink: 0, marginTop: '1px' }} />
                            <p style={{ fontSize: '13px', color: '#16A34A', margin: 0 }}>{success}</p>
                        </div>
                    )}

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Full Name <span style={{ color: '#EF4444' }}>*</span></label>
                        <input type="text" placeholder="John Doe" value={formData.name} onChange={(e) => handleChange('name', e.target.value)} style={fieldStyle} disabled={submitting}
                            onFocus={(e) => { e.target.style.borderColor = '#A78BFA'; e.target.style.boxShadow = '0 0 0 3px rgba(167,139,250,0.15)'; }}
                            onBlur={(e) => { e.target.style.borderColor = '#D1D5DB'; e.target.style.boxShadow = 'none'; }}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Email</label>
                            <input type="email" placeholder="john@example.com" value={formData.email} onChange={(e) => handleChange('email', e.target.value)} style={fieldStyle} disabled={submitting}
                                onFocus={(e) => { e.target.style.borderColor = '#A78BFA'; e.target.style.boxShadow = '0 0 0 3px rgba(167,139,250,0.15)'; }}
                                onBlur={(e) => { e.target.style.borderColor = '#D1D5DB'; e.target.style.boxShadow = 'none'; }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Phone</label>
                            <input type="tel" placeholder="+1 (555) 123-4567" value={formData.phone} onChange={(e) => handleChange('phone', e.target.value)} style={fieldStyle} disabled={submitting}
                                onFocus={(e) => { e.target.style.borderColor = '#A78BFA'; e.target.style.boxShadow = '0 0 0 3px rgba(167,139,250,0.15)'; }}
                                onBlur={(e) => { e.target.style.borderColor = '#D1D5DB'; e.target.style.boxShadow = 'none'; }}
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Notes</label>
                        <textarea placeholder="Any notes about this customer..." value={formData.notes} onChange={(e) => handleChange('notes', e.target.value)}
                            style={{ ...fieldStyle, minHeight: '80px', resize: 'vertical' }} disabled={submitting}
                            onFocus={(e) => { e.target.style.borderColor = '#A78BFA'; e.target.style.boxShadow = '0 0 0 3px rgba(167,139,250,0.15)'; }}
                            onBlur={(e) => { e.target.style.borderColor = '#D1D5DB'; e.target.style.boxShadow = 'none'; }}
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '16px', borderTop: '1px solid #F3F4F6' }}>
                        <Button type="button" variant="outline" onClick={onClose} disabled={submitting} style={{ padding: '10px 20px' }}>Cancel</Button>
                        <Button type="submit" variant="primary" disabled={submitting} style={{ padding: '10px 24px', display: 'flex', alignItems: 'center', gap: '8px', opacity: submitting ? 0.7 : 1 }}>
                            {submitting ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Adding...</> : <><UserPlus size={16} /> Add Customer</>}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

/* ──────────────────────────────────────────────────────── */
/* Main Customers Page                                      */
/* ──────────────────────────────────────────────────────── */
const Customers = () => {
    const [customers, setCustomers] = useState([]);
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [custRes, aptRes] = await Promise.allSettled([
                customersApi.getAll(),
                appointmentsApi.getAll(),
            ]);

            let custList = [];
            if (custRes.status === 'fulfilled' && custRes.value.data?.success) {
                custList = (custRes.value.data.data || []).map(c => ({
                    ...c,
                    id: c.id || c.customer_id || c.ROWID,
                    name: c.name || c.customer_name || 'Unknown',
                    email: c.email || c.customer_email || '',
                    phone: c.phone || c.customer_phone || '',
                }));
            }

            let aptList = [];
            if (aptRes.status === 'fulfilled' && aptRes.value.data?.success) {
                aptList = aptRes.value.data.data || [];
            }

            // If no Customers table records yet, derive unique customers from appointments
            if (custList.length === 0 && aptList.length > 0) {
                const seen = new Set();
                aptList.forEach(apt => {
                    const key = (apt.customer_email || apt.customer_name || '').toLowerCase();
                    if (key && !seen.has(key)) {
                        seen.add(key);
                        custList.push({
                            id: `apt-${apt.id || apt.appointment_id}`,
                            name: apt.customer_name || 'Unknown',
                            email: apt.customer_email || '',
                            phone: '',
                            notes: '',
                            status: 'active',
                            derived: true, // From appointments, not Customers table
                        });
                    }
                });
            }

            setCustomers(custList);
            setAppointments(aptList);
        } catch (err) {
            console.error('Error fetching customers:', err.message || err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Count appointments per customer
    const customerAppointmentCounts = useMemo(() => {
        const counts = {};
        appointments.forEach(apt => {
            const key = (apt.customer_email || apt.customer_name || '').toLowerCase();
            if (key) counts[key] = (counts[key] || 0) + 1;
        });
        return counts;
    }, [appointments]);

    // Last appointment per customer
    const customerLastAppointment = useMemo(() => {
        const last = {};
        appointments.forEach(apt => {
            const key = (apt.customer_email || apt.customer_name || '').toLowerCase();
            if (key) {
                const d = new Date(apt.start_time);
                if (!last[key] || d > last[key]) last[key] = d;
            }
        });
        return last;
    }, [appointments]);

    const filteredCustomers = useMemo(() => {
        if (!searchQuery.trim()) return customers;
        const q = searchQuery.toLowerCase();
        return customers.filter(c =>
            (c.name && c.name.toLowerCase().includes(q)) ||
            (c.email && c.email.toLowerCase().includes(q)) ||
            (c.phone && c.phone.includes(q))
        );
    }, [customers, searchQuery]);

    const handleCustomerAdded = () => {
        fetchData();
    };

    const formatDate = (date) => {
        if (!date) return '-';
        const d = date instanceof Date ? date : new Date(date);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <div className="page-container">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <h1 style={{ fontSize: '18px', fontWeight: 600 }}>Customers</h1>
                    <span style={{
                        backgroundColor: '#F3F4F6', color: 'var(--pk-text-muted)',
                        padding: '2px 10px', borderRadius: '12px', fontSize: '13px', fontWeight: 600
                    }}>{customers.length}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--pk-border)',
                        borderRadius: '6px', padding: '7px 12px', backgroundColor: 'white', width: '220px'
                    }}>
                        <Search size={15} color="#9CA3AF" />
                        <input type="text" placeholder="Search customers..." value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ border: 'none', outline: 'none', fontSize: '13px', width: '100%', backgroundColor: 'transparent' }} />
                    </div>
                    <PermissionGate permission="customers.create">
                        <Button variant="primary" onClick={() => setIsAddModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Plus size={16} /> Add Customer
                        </Button>
                    </PermissionGate>
                </div>
            </div>

            {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#6B7280' }}>Loading Customers...</div>
            ) : filteredCustomers.length === 0 ? (
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
                        {searchQuery ? 'No customers match your search' : 'No customers yet'}
                    </h2>
                    <p style={{ fontSize: '14px', color: '#6B7280', maxWidth: '400px', lineHeight: '1.6', marginBottom: '24px' }}>
                        {searchQuery
                            ? 'Try a different search term.'
                            : 'Customers will appear here once they book appointments, or you can add them manually.'}
                    </p>
                    {!searchQuery && (
                        <PermissionGate permission="customers.create">
                            <Button variant="primary" onClick={() => setIsAddModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px' }}>
                                <Plus size={18} /> Add Your First Customer
                            </Button>
                        </PermissionGate>
                    )}
                </div>
            ) : (
                /* Customer Table */
                <div style={{ backgroundColor: 'white', border: '1px solid var(--pk-border)', borderRadius: '8px', overflow: 'hidden' }}>
                    {/* Table Header */}
                    <div style={{
                        display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 0.5fr',
                        padding: '12px 24px', backgroundColor: '#F8FAFC',
                        borderBottom: '1px solid var(--pk-border)',
                    }}>
                        {['CUSTOMER', 'EMAIL', 'PHONE', 'APPOINTMENTS', 'LAST BOOKING', ''].map(col => (
                            <span key={col} style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569' }}>
                                {col}
                            </span>
                        ))}
                    </div>

                    {/* Customer Rows */}
                    {filteredCustomers.map(customer => {
                        const key = (customer.email || customer.name || '').toLowerCase();
                        const aptCount = customerAppointmentCounts[key] || 0;
                        const lastApt = customerLastAppointment[key];

                        return (
                            <div key={customer.id} style={{
                                display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 0.5fr',
                                padding: '16px 24px', borderBottom: '1px solid #F3F4F6', alignItems: 'center',
                                cursor: 'pointer', transition: 'background-color 0.15s',
                            }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#FAFAFA'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}
                            >
                                {/* Name + Avatar */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                        width: '36px', height: '36px', borderRadius: '50%', backgroundColor: getAvatarColor(customer.name),
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                                        fontSize: '13px', fontWeight: 700, flexShrink: 0,
                                    }}>
                                        {getInitials(customer.name)}
                                    </div>
                                    <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--pk-text-main)' }}>{customer.name}</span>
                                </div>

                                {/* Email */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--pk-text-muted)' }}>
                                    {customer.email && <Mail size={12} />}
                                    {customer.email || '-'}
                                </div>

                                {/* Phone */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--pk-text-muted)' }}>
                                    {customer.phone && <Phone size={12} />}
                                    {customer.phone || '-'}
                                </div>

                                {/* Appointment Count */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Calendar size={13} color="#6B7280" />
                                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--pk-text-main)' }}>{aptCount}</span>
                                    <span style={{ fontSize: '12px', color: 'var(--pk-text-muted)' }}>booking{aptCount !== 1 ? 's' : ''}</span>
                                </div>

                                {/* Last Booking */}
                                <span style={{ fontSize: '13px', color: 'var(--pk-text-muted)' }}>{formatDate(lastApt)}</span>

                                {/* Actions */}
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <button onClick={(e) => e.stopPropagation()} style={{
                                        background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                                        borderRadius: '4px', display: 'flex',
                                    }}>
                                        <MoreHorizontal size={16} color="#9CA3AF" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add Customer Modal */}
            <AddCustomerModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onCustomerAdded={handleCustomerAdded}
            />
        </div>
    );
};

export default Customers;
