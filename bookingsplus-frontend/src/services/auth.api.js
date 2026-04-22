/**
 * Auth API Service — All authentication-related API calls.
 */
import api from './api';

export const authApi = {
    /** Get authenticated user profile + workspaces */
    getMe: () => api.get('/auth/me'),

    /** Get user permissions for the active workspace */
    getMyPermissions: () => api.get('/auth/me/permissions'),
};
