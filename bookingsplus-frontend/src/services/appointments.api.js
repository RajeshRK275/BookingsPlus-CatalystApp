/**
 * Appointments API Service
 */
import api from './api';

export const appointmentsApi = {
    getAll: (params = {}) => api.get('/appointments', { params }),
    book: (data) => api.post('/appointments/book', data),
    update: (id, data) => api.put(`/appointments/${id}`, data),
    remove: (id) => api.delete(`/appointments/${id}`),
};
