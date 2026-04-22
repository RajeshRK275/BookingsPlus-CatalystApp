/**
 * useAppointments — Custom hook for appointments data management.
 */
import { useState, useEffect, useCallback } from 'react';
import { appointmentsApi } from '../services';

export const useAppointments = () => {
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchAppointments = useCallback(async (params) => {
        try {
            setLoading(true);
            setError(null);
            const res = await appointmentsApi.getAll(params);
            if (res.data?.success) {
                setAppointments(res.data.data || []);
            }
        } catch (err) {
            console.error('Error fetching appointments:', err);
            setError(err.message);
            const fallback = JSON.parse(localStorage.getItem('bp_appointments') || '[]');
            setAppointments(fallback);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAppointments();
    }, [fetchAppointments]);

    const bookAppointment = useCallback(async (data) => {
        const res = await appointmentsApi.book(data);
        if (res.data?.success) {
            const newApt = res.data.data;
            setAppointments(prev => [...prev, newApt]);
            return newApt;
        }
        return null;
    }, []);

    return {
        appointments,
        loading,
        error,
        refetch: fetchAppointments,
        bookAppointment,
        setAppointments,
    };
};
