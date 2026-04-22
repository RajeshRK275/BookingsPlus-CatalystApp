/**
 * Workspaces API Service
 */
import api from './api';

export const workspacesApi = {
    getMyWorkspaces: () => api.get('/workspaces/my-workspaces'),
    getById: (id) => api.get(`/workspaces/${id}`),
    getBySlug: (slug) => api.get(`/workspaces/by-slug/${slug}`),
};
