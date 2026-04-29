/**
 * Services API Service
 * 
 * Service Types & Staff Rules:
 * ────────────────────────────
 * one-on-one: Multiple staff assigned, ONE handles each appointment (round-robin by availability)
 * group:      Multiple staff assigned, ONE handles each session, MULTIPLE customers can attend
 * collective: Multiple staff assigned, ALL must be available for booking to happen
 * resource:   No staff needed — booking assets (rooms, equipment)
 */
import api from './api';

export const servicesApi = {
    /** List all services with assignedStaff IDs */
    getAll: () => api.get('/services'),

    /** Get single service by ID with full staff details */
    getById: (id) => api.get(`/services/${id}`),

    /** Create a new service (staff_ids required for non-resource types) */
    create: (data) => api.post('/services', data),

    /** Update service details (NOT staff assignments — use staff-specific endpoints) */
    update: (id, data) => api.put(`/services/${id}`, data),

    /** Delete a service and all its staff assignments */
    remove: (id) => api.delete(`/services/${id}`),

    // ─── Staff Assignment Endpoints ───

    /** Get assigned staff for a service (with user details) */
    getStaff: (serviceId) => api.get(`/services/${serviceId}/staff`),

    /** Add staff to a service (appends to existing, skips duplicates) */
    assignStaff: (serviceId, staffIds) => api.post(`/services/${serviceId}/staff`, { staff_ids: staffIds }),

    /** Replace ALL staff assignments (bulk update) */
    replaceStaff: (serviceId, staffIds) => api.put(`/services/${serviceId}/staff`, { staff_ids: staffIds }),

    /** Remove specific staff from a service */
    unassignStaff: (serviceId, staffIds) => api.delete(`/services/${serviceId}/staff`, { data: { staff_ids: staffIds } }),
};
