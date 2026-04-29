/**
 * Organizations API Service
 * 
 * The /setup endpoint is the heaviest operation in the entire app:
 * Auth middleware (2 DB calls) + create org + seed 25 permissions (1 bulk)
 * + create user + create workspace + seed 4 roles (1 bulk) + seed ~68 role-permissions
 * (1 bulk) + assign user to workspace + mark setup complete = ~12 DB calls total.
 * On a cold start this can take 30-60 seconds.
 */
import api from './api';

export const organizationsApi = {
    setup: (data) => api.post('/organizations/setup', data, { timeout: 180000 }), // 180s — cold start + 12 DB calls
    get: () => api.get('/organizations'),
    update: (data) => api.put('/organizations', data),
};
