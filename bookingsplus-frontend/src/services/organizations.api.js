/**
 * Organizations API Service
 */
import api from './api';

export const organizationsApi = {
    setup: (data) => api.post('/organizations/setup', data),
    get: () => api.get('/organizations'),
    update: (data) => api.put('/organizations', data),
};
