/**
 * API Client — Centralized Axios instance with interceptors.
 * All API calls go through this single instance.
 */
import axios from 'axios';

const API_BASE = '/server/bookingsplus/api/v1';

const api = axios.create({
    baseURL: API_BASE,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor — injects workspace header from localStorage
api.interceptors.request.use((config) => {
    const workspaceId = localStorage.getItem('bp_active_workspace');
    if (workspaceId) {
        config.headers['X-Workspace-Id'] = workspaceId;
    }
    return config;
});

// Response interceptor — unwraps success data, handles errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;
        const message = error.response?.data?.message || error.message;

        // 401 — redirect to Catalyst login
        if (status === 401) {
            console.warn('Session expired, redirecting to login');
            // In production Catalyst handles this automatically
        }

        // Re-throw with structured error info
        const apiError = new Error(message);
        apiError.status = status;
        apiError.code = error.response?.data?.code;
        apiError.data = error.response?.data;
        throw apiError;
    }
);

export default api;
