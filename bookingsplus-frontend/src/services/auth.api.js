/**
 * Auth API Service — All authentication-related API calls.
 * 
 * /auth/me is the FIRST API call the app makes on every page load.
 * On Catalyst serverless, the first request after idle triggers a cold start
 * (10-25 seconds). The /auth/me endpoint also runs auth middleware (2 DB queries)
 * + workspace fetch (1-3 DB queries) + setup check (1 DB query).
 * Total cold-start time can be 20-40 seconds.
 */
import api from './api';

export const authApi = {
    /** Get authenticated user profile + workspaces */
    getMe: () => api.get('/auth/me', { timeout: 120000 }), // 120s — cold start + auth + workspace queries

    /** Get user permissions for the active workspace */
    getMyPermissions: () => api.get('/auth/me/permissions'),
};
