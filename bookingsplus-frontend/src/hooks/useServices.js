/**
 * useServices — Custom hook for services data management.
 * Encapsulates API calls, loading states, and error handling.
 */
import { useState, useEffect, useCallback } from 'react';
import { servicesApi } from '../services';

export const useServices = () => {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchServices = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await servicesApi.getAll();
            if (res.data?.success) {
                setServices(res.data.data || []);
            }
        } catch (err) {
            console.error('Error fetching services:', err);
            setError(err.message);
            // Fallback to localStorage
            const fallback = localStorage.getItem('bp_services');
            if (fallback) setServices(JSON.parse(fallback));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchServices();
    }, [fetchServices]);

    const createService = useCallback(async (data) => {
        const res = await servicesApi.create(data);
        if (res.data?.success) {
            setServices(prev => [...prev, res.data.data]);
            return res.data.data;
        }
        return null;
    }, []);

    const updateService = useCallback(async (id, data) => {
        const res = await servicesApi.update(id, data);
        if (res.data?.success) {
            setServices(prev => prev.map(s =>
                (s.id || s.service_id) === id ? { ...s, ...res.data.data } : s
            ));
            return res.data.data;
        }
        return null;
    }, []);

    const deleteService = useCallback(async (id) => {
        await servicesApi.remove(id);
        setServices(prev => prev.filter(s => (s.id || s.service_id) !== id));
    }, []);

    return {
        services,
        loading,
        error,
        refetch: fetchServices,
        createService,
        updateService,
        deleteService,
    };
};
