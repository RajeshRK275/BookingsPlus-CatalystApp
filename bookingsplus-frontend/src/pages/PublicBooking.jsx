import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Clock, Calendar, Globe, ArrowLeft, Users } from 'lucide-react';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const getServiceFromStorage = (id) => {
    const services = JSON.parse(localStorage.getItem('bp_services') || '[]');
    return services.find(s => String(s.id) === String(id)) || {
        id: parseInt(id), name: 'Service', type: 'one-on-one', duration: 60, price: 'Free', status: 'active'
    };
};

const getInitials = (name) => name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : 'SV';

const formatDuration = (mins) => {
    if (!mins) return '1 hr';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h && m) return `${h} hr ${m} min`;
    if (h) return `${h} hr`;
    return `${m} min`;
};

const generateTimeSlots = (durationMins = 60) => {
    const slots = [];
    const interval = 15;
    for (let hour = 9; hour < 17; hour++) {
        for (let min = 0; min < 60; min += interval) {
            const h = hour > 12 ? hour - 12 : hour;
            const ampm = hour >= 12 ? 'pm' : 'am';
            const mm = min.toString().padStart(2, '0');
            slots.push({
                label: `${h.toString().padStart(2, '0')}:${mm} ${ampm}`,
                hour, min
            });
        }
    }
    return slots;
};

const PublicBooking = () => {
    const { serviceId } = useParams();
    const service = useMemo(() => getServiceFromStorage(serviceId), [serviceId]);

    const today = new Date();
    const [currentMonth, setCurrentMonth] = useState(today.getMonth());
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [step, setStep] = useState(1); // 1 = date/time, 2 = details

    const [formData, setFormData] = useState({ name: '', email: '', phone: '' });
    const [submitting, setSubmitting] = useState(false);
    const [booked, setBooked] = useState(false);
    const [bookingId, setBookingId] = useState(null);

    const timeSlots = useMemo(() => generateTimeSlots(service.duration), [service.duration]);

    // Calendar helpers
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; // Start Monday

    const calendarDays = [];
    for (let i = 0; i < adjustedFirstDay; i++) calendarDays.push(null);
    for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

    const handlePrevMonth = () => {
        if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
        else setCurrentMonth(m => m - 1);
    };
    const handleNextMonth = () => {
        if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
        else setCurrentMonth(m => m + 1);
    };

    const isToday = (day) => day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
    const isPast = (day) => {
        const d = new Date(currentYear, currentMonth, day);
        const t = new Date(); t.setHours(0, 0, 0, 0);
        return d < t;
    };
    const isWeekend = (day) => {
        const d = new Date(currentYear, currentMonth, day).getDay();
        return d === 0 || d === 6;
    };

    const handleDateClick = (day) => {
        if (!day || isPast(day) || isWeekend(day)) return;
        setSelectedDate(new Date(currentYear, currentMonth, day));
        setSelectedSlot(null);
    };

    const handleSlotClick = (slot) => {
        setSelectedSlot(slot);
    };

    const handleSubmit = async () => {
        if (!formData.name || !formData.email || !formData.phone) return;
        setSubmitting(true);

        const startTime = new Date(selectedDate);
        startTime.setHours(selectedSlot.hour, selectedSlot.min, 0, 0);

        const endTime = new Date(startTime);
        endTime.setMinutes(endTime.getMinutes() + (service.duration || 60));

        const appointment = {
            id: `SU-${String(Date.now()).slice(-5)}`,
            service_id: service.id,
            service_name: service.name,
            service_type: service.type,
            customer_name: formData.name,
            customer_email: formData.email,
            customer_phone: formData.phone,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            status: 'upcoming',
            payment_status: 'Free',
            price: service.price || 'Free',
            staff_name: 'Jason Miller',
            booked_at: new Date().toISOString()
        };

        // Save to localStorage
        const appointments = JSON.parse(localStorage.getItem('bp_appointments') || '[]');
        appointments.push(appointment);
        localStorage.setItem('bp_appointments', JSON.stringify(appointments));

        // Save customer
        const customers = JSON.parse(localStorage.getItem('bp_customers') || '[]');
        if (!customers.find(c => c.email === formData.email)) {
            customers.push({
                id: Date.now(),
                name: formData.name,
                email: formData.email,
                phone: formData.phone,
                created_at: new Date().toISOString()
            });
            localStorage.setItem('bp_customers', JSON.stringify(customers));
        }

        setBookingId(appointment.id);
        setBooked(true);
        setSubmitting(false);
    };

    const formatSelectedDate = () => {
        if (!selectedDate) return '';
        return `${selectedDate.getDate()} ${MONTH_NAMES[selectedDate.getMonth()].slice(0, 3)} ${selectedDate.getFullYear()}`;
    };

    if (booked) {
        return (
            <div style={{ minHeight: '100vh', backgroundColor: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{
                    backgroundColor: 'white', borderRadius: '12px', padding: '48px', textAlign: 'center',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.08)', maxWidth: '480px', width: '100%'
                }}>
                    <div style={{
                        width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#DCFCE7',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
                        fontSize: '28px'
                    }}>✓</div>
                    <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Appointment Booked!</h2>
                    <p style={{ color: 'var(--pk-text-muted)', marginBottom: '4px' }}>
                        Booking ID: <strong>{bookingId}</strong>
                    </p>
                    <p style={{ color: 'var(--pk-text-muted)', marginBottom: '20px' }}>
                        {service.name} on {formatSelectedDate()} at {selectedSlot?.label}
                    </p>
                    <p style={{ fontSize: '13px', color: '#9CA3AF' }}>A confirmation email has been sent to {formData.email}</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#F9FAFB' }}>
            {/* Top Bar */}
            <div style={{
                padding: '16px 40px', backgroundColor: 'white',
                borderBottom: '1px solid var(--pk-border)'
            }}>
                <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--pk-text-main)' }}>Bookings+</span>
            </div>

            {/* Main Content */}
            <div style={{
                maxWidth: '960px', margin: '40px auto', padding: '0 20px'
            }}>
                <div style={{
                    backgroundColor: 'white', borderRadius: '12px',
                    boxShadow: '0 1px 8px rgba(0,0,0,0.06)', overflow: 'hidden',
                    display: 'flex', minHeight: '500px'
                }}>
                    {/* Left Sidebar - Service Info */}
                    <div style={{
                        width: '240px', padding: '32px 24px',
                        borderRight: '1px solid var(--pk-border)', flexShrink: 0
                    }}>
                        {step === 2 && (
                            <button onClick={() => setStep(1)} style={{
                                display: 'flex', alignItems: 'center', gap: '4px', background: 'none',
                                border: 'none', cursor: 'pointer', color: 'var(--pk-primary)',
                                fontSize: '13px', marginBottom: '20px', padding: 0
                            }}><ArrowLeft size={14} /> Back</button>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                            <div style={{
                                width: '44px', height: '44px', borderRadius: '10px',
                                backgroundColor: '#C4B5FD', color: 'white',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '14px', fontWeight: 600
                            }}>{getInitials(service.name)}</div>
                            <span style={{ fontSize: '15px', fontWeight: 600 }}>{service.name}</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--pk-text-muted)' }}>
                                <Users size={14} /> Staff
                            </div>
                            {step === 2 && selectedDate && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--pk-text-muted)' }}>
                                    <Calendar size={14} /> {formatSelectedDate()} {selectedSlot?.label}
                                </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--pk-primary)' }}>
                                <Clock size={14} /> {formatDuration(service.duration)}
                            </div>
                            {step === 2 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--pk-text-muted)' }}>
                                    <Globe size={14} /> {Intl.DateTimeFormat().resolvedOptions().timeZone}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Content */}
                    <div style={{ flex: 1, padding: '32px' }}>
                        {step === 1 ? (
                            /* Step 1: Date & Time Selection */
                            <div>
                                <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '24px' }}>Select date and time</h2>
                                <div style={{ display: 'flex', gap: '32px' }}>
                                    {/* Calendar */}
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                                            <button onClick={handlePrevMonth} style={{
                                                background: 'none', border: '1px solid var(--pk-border)', borderRadius: '4px',
                                                padding: '4px 8px', cursor: 'pointer', fontSize: '14px'
                                            }}>‹</button>
                                            <span style={{ fontSize: '14px', fontWeight: 600 }}>
                                                {MONTH_NAMES[currentMonth].slice(0, 3)} {currentYear}
                                            </span>
                                            <button onClick={handleNextMonth} style={{
                                                background: 'none', border: '1px solid var(--pk-border)', borderRadius: '4px',
                                                padding: '4px 8px', cursor: 'pointer', fontSize: '14px'
                                            }}>›</button>
                                        </div>

                                        {/* Day Headers */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', marginBottom: '8px' }}>
                                            {SHORT_DAYS.map((d, i) => (
                                                <div key={i} style={{ fontSize: '12px', fontWeight: 600, color: 'var(--pk-text-muted)', padding: '4px' }}>{d}</div>
                                            ))}
                                        </div>

                                        {/* Day Grid */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center' }}>
                                            {calendarDays.map((day, i) => {
                                                const disabled = !day || isPast(day) || isWeekend(day);
                                                const isSelected = selectedDate && day === selectedDate.getDate() && currentMonth === selectedDate.getMonth() && currentYear === selectedDate.getFullYear();
                                                return (
                                                    <div
                                                        key={i}
                                                        onClick={() => handleDateClick(day)}
                                                        style={{
                                                            padding: '8px', cursor: disabled ? 'default' : 'pointer',
                                                            borderRadius: '6px', fontSize: '13px',
                                                            backgroundColor: isSelected ? 'var(--pk-primary)' : 'transparent',
                                                            color: isSelected ? 'white' : disabled ? '#D1D5DB' : isToday(day) ? 'var(--pk-primary)' : 'var(--pk-text-main)',
                                                            fontWeight: isToday(day) || isSelected ? 600 : 400,
                                                            border: isToday(day) && !isSelected ? '1px solid var(--pk-primary)' : '1px solid transparent',
                                                            transition: 'all 0.15s'
                                                        }}
                                                    >{day || ''}</div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Time Slots */}
                                    {selectedDate && (
                                        <div style={{ width: '180px', flexShrink: 0 }}>
                                            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--pk-primary)', marginBottom: '12px' }}>
                                                {DAY_NAMES[selectedDate.getDay()]}, {MONTH_NAMES[selectedDate.getMonth()].slice(0, 3)} {selectedDate.getDate()}
                                            </div>
                                            <div style={{ maxHeight: '340px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '4px' }}>
                                                {timeSlots.map((slot, i) => (
                                                    <button
                                                        key={i}
                                                        onClick={() => handleSlotClick(slot)}
                                                        style={{
                                                            padding: '10px', border: '1px solid var(--pk-border)',
                                                            borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
                                                            fontWeight: 500, textAlign: 'center',
                                                            backgroundColor: selectedSlot === slot ? 'var(--pk-primary)' : 'white',
                                                            color: selectedSlot === slot ? 'white' : 'var(--pk-text-main)',
                                                            transition: 'all 0.15s'
                                                        }}
                                                    >{slot.label}</button>
                                                ))}
                                            </div>

                                            {selectedSlot && (
                                                <button onClick={() => setStep(2)} style={{
                                                    width: '100%', padding: '10px', backgroundColor: 'var(--pk-primary)',
                                                    color: 'white', border: 'none', borderRadius: '6px',
                                                    cursor: 'pointer', fontSize: '14px', fontWeight: 500, marginTop: '12px'
                                                }}>Next →</button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            /* Step 2: Customer Details Form */
                            <div>
                                <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '24px' }}>Please enter your details</h2>
                                <div style={{ maxWidth: '380px' }}>
                                    <div style={{ marginBottom: '20px' }}>
                                        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>
                                            Name <span style={{ color: '#EF4444' }}>*</span>
                                        </label>
                                        <input
                                            className="input" placeholder="Name" value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        />
                                    </div>
                                    <div style={{ marginBottom: '20px' }}>
                                        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>
                                            Email <span style={{ color: '#EF4444' }}>*</span>
                                        </label>
                                        <input
                                            className="input" type="email" placeholder="Email" value={formData.email}
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        />
                                    </div>
                                    <div style={{ marginBottom: '28px' }}>
                                        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>
                                            Contact Number <span style={{ color: '#EF4444' }}>*</span>
                                        </label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
                                            <div style={{
                                                padding: '10px 10px', backgroundColor: '#F9FAFB',
                                                border: '1px solid var(--pk-border)', borderRadius: '4px 0 0 4px',
                                                fontSize: '13px', color: 'var(--pk-text-muted)', whiteSpace: 'nowrap'
                                            }}>🇮🇳 +91</div>
                                            <input
                                                className="input" placeholder="Contact Number" value={formData.phone}
                                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                                style={{ borderRadius: '0 4px 4px 0', borderLeft: 'none' }}
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleSubmit}
                                        disabled={submitting || !formData.name || !formData.email || !formData.phone}
                                        style={{
                                            width: '100%', padding: '14px', backgroundColor: 'var(--pk-primary)',
                                            color: 'white', border: 'none', borderRadius: '6px',
                                            cursor: 'pointer', fontSize: '15px', fontWeight: 600,
                                            opacity: (!formData.name || !formData.email || !formData.phone) ? 0.6 : 1
                                        }}
                                    >
                                        {submitting ? 'Scheduling...' : 'Schedule Appointment'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--pk-text-muted)', fontSize: '12px' }}>
                    <span>Powered by </span>
                    <strong style={{ color: 'var(--pk-text-main)' }}>Bookings</strong>
                </div>
            </div>
        </div>
    );
};

export default PublicBooking;
