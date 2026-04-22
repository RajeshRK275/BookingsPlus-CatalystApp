/**
 * Services API Service
 */
import api from './api';

export const servicesApi = {
    getAll: () => api.get('/services'),
    create: (data) => api.post('/services', data),
    update: (id, data) => api.put(`/services/${id}`, data),
    remove: (id) => api.delete(`/services/${id}`),
};
