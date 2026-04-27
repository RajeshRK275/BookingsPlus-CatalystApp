import React, { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Clock, Calendar, Globe, ArrowLeft, Users } from 'lucide-react';
import { servicesApi, appointmentsApi } from '../services';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

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
    const [service, setService] = useState({ id: parseInt(serviceId), name: 'Loading Service...', duration: 60, price: 'Free' });
    
    useEffect(() => {
        const fetchService = async () => {
             try {
                const response = await servicesApi.getAll();
                if (response.data && response.data.success) {
                    const allSvcs = (response.data.data || []).map(s => ({
                        ...s,
                        name: s.name || s.service_name || 'Untitled',
                        id: s.id || s.service_id || s.ROWID,
                    }));
                    const svc = allSvcs.find(s => String(s.id) === String(serviceId));
                    if (svc) setService(svc);
                }
             } catch (err) {
                console.error('Error fetching service for public booking:', err.message || err);
             }
        };
        fetchService();
    }, [serviceId]);

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

    const timeSlots = useMemo(() => generateTimeSlots(service.duration_minutes || service.duration), [service.duration_minutes, service.duration]);

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
        endTime.setMinutes(endTime.getMinutes() + (service.duration_minutes || service.duration || 60));

        const payload = {
            service_id: service.id || service.service_id,
            service_name: service.name,
            customer_name: formData.name,
            customer_email: formData.email,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            staff_id: 'default' // Add staff selection if required
        };

        try {
            const res = await appointmentsApi.book(payload);
            if (res.data?.success) {
                setBookingId(res.data.data?.appointment_id || res.data.data?.ROWID || `SU-${Date.now()}`);
                setBooked(true);
            }
        } catch (err) {
            const errorMsg = err.data?.message || err.message || 'Booking failed';
            console.error('Booking error:', errorMsg);
            alert(`Booking failed: ${errorMsg}`);
        } finally {
            setSubmitting(false);
        }
    };

    if (booked) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC', padding: '20px' }}>
                <div style={{ width: '100%', maxWidth: '450px', backgroundColor: 'white', borderRadius: '16px', padding: '40px 32px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', textAlign: 'center' }}>
                    <div style={{ width: '64px', height: '64px', backgroundColor: '#DCFCE7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                    <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>Booking Confirmed!</h2>
                    <p style={{ color: '#6B7280', fontSize: '15px', marginBottom: '24px', lineHeight: '1.5' }}>
                        You are scheduled with <strong style={{ color: '#374151' }}>{service.name}</strong>.<br />
                        Booking ID: <span style={{ fontFamily: 'monospace', backgroundColor: '#F1F5F9', padding: '2px 6px', borderRadius: '4px' }}>{bookingId}</span>
                    </p>
                    <div style={{ backgroundColor: '#F8FAFC', borderRadius: '12px', padding: '20px', textAlign: 'left', marginBottom: '32px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', fontSize: '14px', color: '#475569' }}>
                            <Calendar size={18} color="#4F46E5" />
                            <strong>{DAY_NAMES[selectedDate.getDay()]}, {MONTH_NAMES[selectedDate.getMonth()]} {selectedDate.getDate()}, {selectedDate.getFullYear()}</strong>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', fontSize: '14px', color: '#475569' }}>
                            <Clock size={18} color="#4F46E5" />
                            <strong>{selectedSlot.label}</strong> ({(service.duration_minutes || service.duration || 60)} min)
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: '#475569' }}>
                            <Globe size={18} color="#4F46E5" />
                            <strong>India Standard Time</strong>
                        </div>
                    </div>
                    <button style={{ width: '100%', padding: '12px', backgroundColor: 'white', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
                        Add to Calendar
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFC', display: 'flex', justifyContent: 'center', padding: '40px 20px', fontFamily: '"Inter", sans-serif' }}>
            <div style={{ width: '100%', maxWidth: step === 1 && selectedDate ? '1000px' : '850px', backgroundColor: 'white', borderRadius: '16px', display: 'flex', border: '1px solid #E2E8F0', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)', overflow: 'hidden', transition: 'max-width 0.3s ease' }}>
                
                {/* Left Panel: Service Info */}
                <div style={{ width: '320px', backgroundColor: '#FAFAFA', borderRight: '1px solid #E2E8F0', padding: '32px', flexShrink: 0 }}>
                    {step === 2 && (
                        <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', color: '#111827', fontWeight: 600, fontSize: '14px', cursor: 'pointer', marginBottom: '32px', padding: '0' }}>
                            <ArrowLeft size={16} /> Back
                        </button>
                    )}

                    <div style={{ padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: '8px', backgroundColor: 'white', fontSize: '12px', fontWeight: 600, color: '#4B5563', display: 'inline-block', marginBottom: '16px' }}>
                        BOOKINGS+
                    </div>
                    
                    <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginBottom: '16px', lineHeight: '1.2' }}>{service.name}</h1>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#4B5563', fontSize: '14.5px', fontWeight: 500 }}>
                            <Clock size={20} color="#6B7280" />
                            {formatDuration(service.duration_minutes || service.duration || 60)}
                        </div>
                        {(service.service_type === 'group' || service.type === 'group') && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#4B5563', fontSize: '14.5px', fontWeight: 500 }}>
                                <Users size={20} color="#6B7280" />
                                Group Booking
                            </div>
                        )}
                        {step === 2 && selectedDate && selectedSlot && (
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', color: '#16A34A', fontSize: '14.5px', fontWeight: 600 }}>
                                <Calendar size={20} color="#16A34A" style={{ marginTop: '2px' }}/>
                                <div>
                                    {selectedSlot.label} - {DAY_NAMES[selectedDate.getDay()]}, {MONTH_NAMES[selectedDate.getMonth()]} {selectedDate.getDate()}, {selectedDate.getFullYear()}
                                </div>
                            </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#4B5563', fontSize: '14.5px', fontWeight: 500 }}>
                            <Globe size={20} color="#6B7280" />
                            India Standard Time
                        </div>
                    </div>
                    <div style={{ fontSize: '14px', color: '#6B7280', lineHeight: '1.6' }}>
                        {service.description || 'Welcome to my scheduling page. Please follow the instructions to add an event to my calendar.'}
                    </div>
                </div>

                {/* Right Panel: Calendar or Form */}
                <div style={{ flex: 1, padding: '32px', display: 'flex', flexDirection: step === 1 && selectedDate ? 'row' : 'column', gap: '32px' }}>
                    {step === 1 ? (
                        <>
                            <div style={{ flex: 2 }}>
                                <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', marginBottom: '24px' }}>Select a Date & Time</h2>
                                
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                    <span style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>
                                        {MONTH_NAMES[currentMonth]} {currentYear}
                                    </span>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={handlePrevMonth} style={{ background: '#F3F4F6', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#E5E7EB'} onMouseLeave={e => e.currentTarget.style.background = '#F3F4F6'}>
                                            <ArrowLeft size={16} />
                                        </button>
                                        <button onClick={handleNextMonth} style={{ background: '#F3F4F6', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s', transform: 'rotate(180deg)' }} onMouseEnter={e => e.currentTarget.style.background = '#E5E7EB'} onMouseLeave={e => e.currentTarget.style.background = '#F3F4F6'}>
                                            <ArrowLeft size={16} />
                                        </button>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', marginBottom: '12px' }}>
                                    {SHORT_DAYS.map((day, i) => (
                                        <div key={i} style={{ textAlign: 'center', fontSize: '11px', fontWeight: 600, color: '#6B7280' }}>{day}</div>
                                    ))}
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
                                    {calendarDays.map((day, i) => {
                                        const disabled = !day || isPast(day) || isWeekend(day);
                                        const isSelected = selectedDate && day === selectedDate.getDate() && currentMonth === selectedDate.getMonth();
                                        const todayFlag = day && isToday(day);

                                        return (
                                            <div key={i} 
                                                onClick={() => handleDateClick(day)}
                                                style={{
                                                    aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '15px', fontWeight: isSelected || todayFlag ? 600 : 500,
                                                    borderRadius: '50%', cursor: disabled ? 'default' : 'pointer',
                                                    color: disabled ? '#D1D5DB' : (isSelected ? 'white' : (todayFlag ? '#4F46E5' : '#111827')),
                                                    backgroundColor: isSelected ? '#4F46E5' : (todayFlag ? '#EEF2FF' : 'transparent'),
                                                    border: isSelected ? '1px solid #4F46E5' : '1px solid transparent',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={e => { if (!disabled && !isSelected) e.currentTarget.style.backgroundColor = '#F3F4F6'; }}
                                                onMouseLeave={e => { if (!disabled && !isSelected) e.currentTarget.style.backgroundColor = todayFlag ? '#EEF2FF' : 'transparent'; }}
                                            >
                                                {day || ''}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {selectedDate && (
                                <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', height: '400px' }}>
                                    <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '24px', color: '#111827' }}>
                                        {DAY_NAMES[selectedDate.getDay()]}, {MONTH_NAMES[selectedDate.getMonth()]} {selectedDate.getDate()}
                                    </h3>
                                    <div style={{ overflowY: 'auto', paddingRight: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {timeSlots.map((slot, i) => (
                                            <div key={i} style={{ display: 'flex', gap: '8px' }}>
                                                <button 
                                                    onClick={() => handleSlotClick(slot)}
                                                    style={{
                                                        flex: 1, padding: '14px', borderRadius: '8px', fontSize: '15px', fontWeight: 600,
                                                        border: selectedSlot === slot ? '2px solid #111827' : '1px solid #CBD5E1',
                                                        backgroundColor: selectedSlot === slot ? '#111827' : 'white',
                                                        color: selectedSlot === slot ? 'white' : '#4F46E5',
                                                        cursor: 'pointer', transition: 'all 0.15s'
                                                    }}
                                                    onMouseEnter={e => { if (selectedSlot !== slot) { e.currentTarget.style.border = '1px solid #4F46E5'; e.currentTarget.style.borderWidth = '2px'; e.currentTarget.style.padding = '13px'; } }}
                                                    onMouseLeave={e => { if (selectedSlot !== slot) { e.currentTarget.style.border = '1px solid #CBD5E1'; e.currentTarget.style.padding = '14px'; } }}
                                                >
                                                    {slot.label}
                                                </button>
                                                {selectedSlot === slot && (
                                                    <button onClick={() => setStep(2)} style={{ padding: '0 24px', backgroundColor: '#4F46E5', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', transition: 'background-color 0.2s', animation: 'fadeIn 0.2s ease-in-out' }}>
                                                        Next
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div style={{ maxWidth: '400px' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', marginBottom: '24px' }}>Enter Details</h2>
                            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Name *</label>
                                    <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s' }} onFocus={e => e.target.style.borderColor = '#4F46E5'} onBlur={e => e.target.style.borderColor = '#D1D5DB'} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Email *</label>
                                    <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s' }} onFocus={e => e.target.style.borderColor = '#4F46E5'} onBlur={e => e.target.style.borderColor = '#D1D5DB'} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Phone Number *</label>
                                    <div style={{ display: 'flex' }}>
                                        <div style={{ padding: '12px 16px', backgroundColor: '#F3F4F6', border: '1px solid #D1D5DB', borderRight: 'none', borderRadius: '8px 0 0 8px', fontSize: '15px', color: '#4B5563' }}>+91</div>
                                        <input type="tel" required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} style={{ flex: 1, padding: '12px 14px', borderRadius: '0 8px 8px 0', border: '1px solid #D1D5DB', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s' }} onFocus={e => e.target.style.borderColor = '#4F46E5'} onBlur={e => e.target.style.borderColor = '#D1D5DB'} />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                                    <input type="checkbox" id="sms" style={{ width: '16px', height: '16px' }} />
                                    <label htmlFor="sms" style={{ fontSize: '14px', color: '#4B5563' }}>Send text messages to this number</label>
                                </div>
                                <button type="submit" disabled={submitting} style={{ width: 'fit-content', marginTop: '16px', padding: '12px 24px', backgroundColor: '#4F46E5', color: 'white', border: 'none', borderRadius: '24px', fontSize: '15px', fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
                                    {submitting ? 'Scheduling...' : 'Schedule Event'}
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PublicBooking;
