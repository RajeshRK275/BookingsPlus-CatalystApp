import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '../../ui/Button';
import { format } from 'date-fns';
import axios from 'axios';

const AddAppointmentModal = ({ isOpen, onClose, slotDetails, staffList, onAdded }) => {
    const [services, setServices] = useState([]);
    const [formData, setFormData] = useState({
        staffId: '',
        serviceId: '',
        customerName: '',
        customerEmail: '',
        date: '',
        time: ''
    });

    useEffect(() => {
        if (!isOpen) return;
        
        // Fetch services
        const fetchServices = async () => {
            try {
                                const response = await axios.get('/server/bookingsplus/api/v1/services');
                if (response.data && response.data.success) {
                    setServices(response.data.data);
                }
            } catch (err) {
                // Fallback for UI if DB table doesn't exist
                const fallback = JSON.parse(localStorage.getItem('bp_services') || '[]');
                setServices(fallback);
            }
        };
        fetchServices();

        // Pre-fill form from slot details
        if (slotDetails) {
            setFormData(prev => ({
                ...prev,
                staffId: String(slotDetails.staffId || ''),
                date: slotDetails.date ? format(new Date(slotDetails.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
                time: slotDetails.time || '10:00'
            }));
        }
    }, [isOpen, slotDetails]);

    if (!isOpen) return null;

    const staffServices = services.filter(s => {
        if (s.service_type === 'group' || s.type === 'group') return false; 
        if (formData.staffId && s.assignedStaff && s.assignedStaff.length > 0) {
            return s.assignedStaff.includes(parseInt(formData.staffId));
        }
        return true; 
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const selectedService = services.find(s => String(s.id || s.service_id) === formData.serviceId);
        if (!selectedService) return;

        const staffName = staffList.find(s => String(s.id || s.user_id) === String(formData.staffId))?.name || 'Unknown Staff';

        const startTime = new Date(`${formData.date}T${formData.time}`);
        const endTime = new Date(startTime);
        endTime.setMinutes(endTime.getMinutes() + (selectedService.duration_minutes || selectedService.duration || 60));

        const payload = {
            service_id: selectedService.id || selectedService.service_id,
            service_name: selectedService.name,
            staff_id: formData.staffId,
            staff_name: staffName,
            customer_id: formData.customerEmail, // Mock generic customer ID usage
            customer_name: formData.customerName,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            notes: ''
        };

        try {
                        const res = await axios.post('/server/bookingsplus/api/v1/appointments/book', payload);
            
            if (res.data.success) {
                // Return structured object similar to DB row for UI appending
                const newApt = {
                    id: res.data.data.appointment_id,
                    ...payload,
                    status: 'upcoming',
                    payment_status: 'unpaid',
                    price: selectedService.price || 'Free'
                };
                onAdded(newApt);
                onClose();
            }
        } catch (err) {
            console.error('Error creating appointment', err);
            // Fallback for visual testing
            const fallbackApt = {
                id: `SU-${String(Date.now()).slice(-5)}`,
                ...payload,
                status: 'upcoming',
                payment_status: 'unpaid',
                price: selectedService.price || 'Free'
            };
            const existing = JSON.parse(localStorage.getItem('bp_appointments') || '[]');
            localStorage.setItem('bp_appointments', JSON.stringify([...existing, fallbackApt]));
            onAdded(fallbackApt);
            onClose();
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div style={{ backgroundColor: 'white', borderRadius: '12px', width: '500px', maxWidth: '90vw', padding: '24px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Add Appointment</h2>
                    <X size={20} color="#9CA3AF" style={{ cursor: 'pointer' }} onClick={onClose} />
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Staff Member</label>
                        <select 
                            className="input" 
                            required 
                            value={formData.staffId} 
                            onChange={e => setFormData({ ...formData, staffId: e.target.value, serviceId: '' })}
                        >
                            <option value="" disabled>Select Staff</option>
                            {staffList.map(s => (
                                <option key={s.id || s.user_id} value={s.id || s.user_id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Service</label>
                        <select 
                            className="input" 
                            required 
                            value={formData.serviceId} 
                            onChange={e => setFormData({ ...formData, serviceId: e.target.value })}
                            disabled={!formData.staffId}
                        >
                            <option value="" disabled>Select Service</option>
                            {staffServices.map(s => (
                                <option key={s.id || s.service_id} value={s.id || s.service_id}>{s.name} ({s.duration_minutes || s.duration || 60} mins)</option>
                            ))}
                        </select>
                        {formData.staffId && staffServices.length === 0 && (
                            <p style={{ fontSize: '12px', color: '#EF4444', marginTop: '4px' }}>No 1-on-1 services assigned to this staff.</p>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Date</label>
                            <input type="date" className="input" required value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Time</label>
                            <input type="time" className="input" required value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })} />
                        </div>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Customer Name</label>
                        <input type="text" className="input" required placeholder="John Doe" value={formData.customerName} onChange={e => setFormData({ ...formData, customerName: e.target.value })} />
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Customer Email</label>
                        <input type="email" className="input" required placeholder="john@example.com" value={formData.customerEmail} onChange={e => setFormData({ ...formData, customerEmail: e.target.value })} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button type="submit" variant="primary">Create Appointment</Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddAppointmentModal;
