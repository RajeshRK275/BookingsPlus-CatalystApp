/**
 * useEmployees — Custom hook for employee data management.
 */
import { useState, useEffect, useCallback } from 'react';
import { usersApi } from '../services';

export const useEmployees = () => {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchEmployees = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await usersApi.getAll();
            if (res.data?.success) {
                setEmployees(res.data.data || []);
            }
        } catch (err) {
            console.error('Error fetching employees:', err);
            setError(err.message);
            const fallback = localStorage.getItem('bp_employees');
            if (fallback) setEmployees(JSON.parse(fallback));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchEmployees();
    }, [fetchEmployees]);

    const getById = useCallback((id) => {
        return employees.find(e => String(e.id || e.user_id) === String(id));
    }, [employees]);

    return {
        employees,
        loading,
        error,
        refetch: fetchEmployees,
        getById,
    };
};
