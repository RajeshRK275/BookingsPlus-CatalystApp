/**
 * Customers API Service
 */
import api from './api';

export const customersApi = {
    getAll: () => api.get('/customers'),
    getById: (id) => api.get(`/customers/${id}`),
    create: (data) => api.post('/customers', data),
    update: (id, data) => api.put(`/customers/${id}`, data),
    remove: (id) => api.delete(`/customers/${id}`),
};
