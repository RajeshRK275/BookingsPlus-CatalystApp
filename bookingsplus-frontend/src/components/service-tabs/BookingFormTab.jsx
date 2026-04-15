import React, { useState, useRef } from 'react';
import { Button } from '../../ui/Button';
import { GripVertical, X, Type, AlignLeft, Mail, CheckSquare, CircleDot, ChevronDown, Calendar, MapPin } from 'lucide-react';

const FIELD_TYPES = [
    { type: 'singleline', label: 'SingleLine', icon: Type },
    { type: 'multiline', label: 'MultiLine', icon: AlignLeft },
    { type: 'email', label: 'Email', icon: Mail },
    { type: 'checkbox', label: 'CheckBox', icon: CheckSquare },
    { type: 'radio', label: 'RadioButton', icon: CircleDot },
    { type: 'dropdown', label: 'DropDown', icon: ChevronDown },
    { type: 'date', label: 'Date', icon: Calendar },
    { type: 'address', label: 'Address', icon: MapPin }
];

const DEFAULT_FIELDS = [
    { id: 'f1', label: 'Name', type: 'singleline', required: true, isDefault: true },
    { id: 'f2', label: 'Email', type: 'email', required: true, isDefault: true },
    { id: 'f3', label: 'Contact Number', type: 'singleline', required: true, isDefault: true },
    { id: 'f4', label: 'Invite Guest(s)', type: 'singleline', required: false, isDefault: false },
];

const DEFAULT_CONSENT = {
    termsAndConditions: false,
    captcha: false
};

const DEFAULT_BUTTONS = {
    freeLabel: 'Schedule Appointment',
    paidLabel: 'Pay and Schedule Appointment'
};

const ToggleSwitch = ({ checked, onChange }) => (
    <div onClick={onChange} style={{
        width: '40px', height: '22px', borderRadius: '11px', cursor: 'pointer',
        backgroundColor: checked ? 'var(--pk-primary)' : '#D1D5DB',
        position: 'relative', transition: 'background-color 0.2s', flexShrink: 0
    }}>
        <div style={{
            width: '18px', height: '18px', borderRadius: '50%', backgroundColor: 'white',
            position: 'absolute', top: '2px', left: checked ? '20px' : '2px',
            transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
        }} />
    </div>
);

const BookingFormTab = ({ service, onUpdate }) => {
    const [fields, setFields] = useState(service.bookingFormFields || DEFAULT_FIELDS);
    const [consent, setConsent] = useState(service.bookingFormConsent || DEFAULT_CONSENT);
    const [buttons, setButtons] = useState(service.bookingFormButtons || DEFAULT_BUTTONS);
    const [showAddPanel, setShowAddPanel] = useState(false);
    const [editingField, setEditingField] = useState(null);
    const [editingButtons, setEditingButtons] = useState(false);
    const [editLabel, setEditLabel] = useState('');
    const dragItem = useRef(null);
    const dragOverItem = useRef(null);

    const handleDragStart = (index) => {
        dragItem.current = index;
    };

    const handleDragEnter = (index) => {
        dragOverItem.current = index;
    };

    const handleDragEnd = () => {
        if (dragItem.current === null || dragOverItem.current === null) return;
        const updated = [...fields];
        const draggedItem = updated.splice(dragItem.current, 1)[0];
        updated.splice(dragOverItem.current, 0, draggedItem);
        setFields(updated);
        dragItem.current = null;
        dragOverItem.current = null;
        saveFields(updated);
    };

    const handleAddField = (fieldType) => {
        const newField = {
            id: `f_${Date.now()}`,
            label: fieldType.label,
            type: fieldType.type,
            required: false,
            isDefault: false
        };
        const updated = [...fields, newField];
        setFields(updated);
        saveFields(updated);
        setShowAddPanel(false);
    };

    const handleRemoveField = (fieldId) => {
        const updated = fields.filter(f => f.id !== fieldId);
        setFields(updated);
        saveFields(updated);
    };

    const handleToggleRequired = (fieldId) => {
        const updated = fields.map(f => f.id === fieldId ? { ...f, required: !f.required } : f);
        setFields(updated);
        saveFields(updated);
    };

    const startEditLabel = (field) => {
        setEditingField(field.id);
        setEditLabel(field.label);
    };

    const saveEditLabel = () => {
        if (editingField && editLabel.trim()) {
            const updated = fields.map(f => f.id === editingField ? { ...f, label: editLabel.trim() } : f);
            setFields(updated);
            saveFields(updated);
        }
        setEditingField(null);
        setEditLabel('');
    };

    const saveFields = (updatedFields) => {
        onUpdate({ ...service, bookingFormFields: updatedFields || fields, bookingFormConsent: consent, bookingFormButtons: buttons });
    };

    return (
        <div style={{ position: 'relative' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '3px', height: '20px', backgroundColor: 'var(--pk-primary)', borderRadius: '2px' }} />
                    <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Booking Form</h3>
                </div>
                <Button variant="secondary" onClick={() => setShowAddPanel(!showAddPanel)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    + Add Field
                </Button>
            </div>

            <div style={{ display: 'flex', gap: '24px' }}>
                {/* Form Fields List */}
                <div style={{ flex: 1 }}>
                    {/* Draggable Fields */}
                    <div style={{ marginBottom: '32px' }}>
                        {fields.map((field, index) => (
                            <div
                                key={field.id}
                                draggable
                                onDragStart={() => handleDragStart(index)}
                                onDragEnter={() => handleDragEnter(index)}
                                onDragEnd={handleDragEnd}
                                onDragOver={(e) => e.preventDefault()}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '12px 16px', borderBottom: '1px solid #F3F4F6',
                                    cursor: 'grab', backgroundColor: 'white',
                                    transition: 'background-color 0.15s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FAFAFA'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <GripVertical size={16} color="#D1D5DB" style={{ cursor: 'grab' }} />
                                    {editingField === field.id ? (
                                        <input
                                            className="input"
                                            value={editLabel}
                                            onChange={(e) => setEditLabel(e.target.value)}
                                            onBlur={saveEditLabel}
                                            onKeyDown={(e) => e.key === 'Enter' && saveEditLabel()}
                                            autoFocus
                                            style={{ padding: '4px 8px', fontSize: '14px', width: '200px' }}
                                        />
                                    ) : (
                                        <span
                                            onClick={() => startEditLabel(field)}
                                            style={{
                                                fontSize: '14px', fontWeight: 500, cursor: 'text',
                                                color: 'var(--pk-primary)'
                                            }}
                                        >
                                            {field.label}{field.required && <span style={{ color: '#EF4444' }}>*</span>}
                                        </span>
                                    )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <label style={{
                                        display: 'flex', alignItems: 'center', gap: '4px',
                                        fontSize: '11px', color: 'var(--pk-text-muted)', cursor: 'pointer'
                                    }}>
                                        <input type="checkbox" checked={field.required}
                                            onChange={() => handleToggleRequired(field.id)}
                                            style={{ accentColor: 'var(--pk-primary)' }} />
                                        Required
                                    </label>
                                    {!field.isDefault && (
                                        <button onClick={() => handleRemoveField(field.id)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D1D5DB', padding: '2px' }}>
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Consent and Verification */}
                    <div style={{ marginBottom: '32px' }}>
                        <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', color: 'var(--pk-text-main)' }}>
                            Consent and Verification
                        </h4>
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '12px 16px', borderBottom: '1px solid #F3F4F6'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <GripVertical size={16} color="#D1D5DB" />
                                <span style={{ fontSize: '14px', fontWeight: 500 }}>Terms and Conditions</span>
                            </div>
                            <ToggleSwitch checked={consent.termsAndConditions}
                                onChange={() => {
                                    const updated = { ...consent, termsAndConditions: !consent.termsAndConditions };
                                    setConsent(updated);
                                    onUpdate({ ...service, bookingFormConsent: updated });
                                }} />
                        </div>
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '12px 16px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <GripVertical size={16} color="#D1D5DB" />
                                <span style={{ fontSize: '14px', fontWeight: 500 }}>CAPTCHA</span>
                            </div>
                            <ToggleSwitch checked={consent.captcha}
                                onChange={() => {
                                    const updated = { ...consent, captcha: !consent.captcha };
                                    setConsent(updated);
                                    onUpdate({ ...service, bookingFormConsent: updated });
                                }} />
                        </div>
                    </div>

                    {/* Booking Confirmation Button */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--pk-text-main)' }}>
                                Booking Confirmation Button
                            </h4>
                            {editingButtons ? (
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <Button variant="primary" onClick={() => {
                                        onUpdate({ ...service, bookingFormButtons: buttons });
                                        setEditingButtons(false);
                                    }} style={{ padding: '4px 16px', fontSize: '12px' }}>Save</Button>
                                    <Button variant="secondary" onClick={() => {
                                        setButtons(service.bookingFormButtons || DEFAULT_BUTTONS);
                                        setEditingButtons(false);
                                    }} style={{ padding: '4px 16px', fontSize: '12px' }}>Cancel</Button>
                                </div>
                            ) : (
                                <Button variant="secondary" onClick={() => setEditingButtons(true)}
                                    style={{ padding: '4px 16px', fontSize: '12px' }}>✏️ Edit</Button>
                            )}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                            <div>
                                <div style={{ fontSize: '13px', color: 'var(--pk-primary)', marginBottom: '6px' }}>Free Appointments</div>
                                {editingButtons ? (
                                    <input className="input" value={buttons.freeLabel}
                                        onChange={e => setButtons({ ...buttons, freeLabel: e.target.value })} />
                                ) : (
                                    <div style={{ fontSize: '14px', fontWeight: 500 }}>{buttons.freeLabel}</div>
                                )}
                            </div>
                            <div>
                                <div style={{ fontSize: '13px', color: 'var(--pk-primary)', marginBottom: '6px' }}>Paid Appointments</div>
                                {editingButtons ? (
                                    <input className="input" value={buttons.paidLabel}
                                        onChange={e => setButtons({ ...buttons, paidLabel: e.target.value })} />
                                ) : (
                                    <div style={{ fontSize: '14px', fontWeight: 500 }}>{buttons.paidLabel}</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Add Field Panel */}
                {showAddPanel && (
                    <div style={{
                        width: '240px', flexShrink: 0, backgroundColor: 'white',
                        border: '1px solid var(--pk-border)', borderRadius: '8px',
                        padding: '16px', alignSelf: 'flex-start',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h4 style={{ fontSize: '14px', fontWeight: 600 }}>Add New Field</h4>
                            <button onClick={() => setShowAddPanel(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}>
                                <X size={16} />
                            </button>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--pk-text-muted)', marginBottom: '12px' }}>Field Types</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            {FIELD_TYPES.map(ft => {
                                const Icon = ft.icon;
                                return (
                                    <div
                                        key={ft.type}
                                        onClick={() => handleAddField(ft)}
                                        style={{
                                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                                            justifyContent: 'center', gap: '6px', padding: '16px 8px',
                                            borderRadius: '8px', border: '1px solid var(--pk-border)',
                                            cursor: 'pointer', transition: 'all 0.15s',
                                            backgroundColor: 'white'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = '#F3F0FF';
                                            e.currentTarget.style.borderColor = 'var(--pk-primary)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = 'white';
                                            e.currentTarget.style.borderColor = 'var(--pk-border)';
                                        }}
                                    >
                                        <Icon size={20} color="#6B7280" />
                                        <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--pk-text-main)' }}>
                                            {ft.label}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BookingFormTab;
