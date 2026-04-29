/**
 * API Client — Centralized Axios instance with interceptors.
 * All API calls go through this single instance.
 * 
 * TIMEOUT STRATEGY:
 * - Default: 90s (Catalyst serverless cold starts can take 15-25s on first hit)
 * - Setup endpoints: 180s (bulk DB operations: permissions, roles, etc.)
 * - Auth/me: 90s (cold start + DB lookups)
 * - Per-request override: api.get('/url', { timeout: 90000 })
 */
import axios from 'axios';

const API_BASE = '/server/bookingsplus/api/v1';

const api = axios.create({
    baseURL: API_BASE,
    timeout: 90000,  // 90s default — Catalyst cold starts can take 15-25s + DB latency
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor — injects workspace header + auto-extends timeout for heavy endpoints
api.interceptors.request.use((config) => {
    const workspaceId = localStorage.getItem('bp_active_workspace');
    if (workspaceId && workspaceId !== 'undefined' && workspaceId !== 'null') {
        config.headers['X-Workspace-Id'] = workspaceId;
    }

    // Auto-extend timeout for setup/seeding endpoints (lots of bulk DB inserts)
    const url = config.url || '';
    if (url.includes('/organizations/setup') || url.includes('/admin/migrate')) {
        config.timeout = 180000; // 180s for setup operations (cold start + ~12 DB calls)
    }

    return config;
});

// Response interceptor — unwraps success data, handles errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;
        const data = error.response?.data;
        const message = data?.message || error.message || 'Unknown API error';

        console.warn(`[API] Error: status=${status}, message="${message}", url=${error.config?.url}`);

        // 401 — Session expired
        if (status === 401) {
            console.warn('[API] 401 — Session expired, redirecting to Catalyst login...');
            if (!window.__catalystLoginRedirecting) {
                window.__catalystLoginRedirecting = true;
                setTimeout(() => {
                    window.location.href = '/__catalyst/auth/login';
                }, 100);
            }
        }

        const apiError = {
            message,
            status: status || undefined,
            code: data?.code,
            data: data,
            isApiError: true,
        };
        return Promise.reject(apiError);
    }
);

export default api;
