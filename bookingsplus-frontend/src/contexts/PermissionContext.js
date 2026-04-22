import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useWorkspace } from './WorkspaceContext';
import { authApi } from '../services';

const PermissionContext = createContext(null);

export const PermissionProvider = ({ children }) => {
    const { user, isAuthenticated } = useAuth();
    const { activeWorkspace } = useWorkspace();
    const [permissions, setPermissions] = useState(new Set());
    const [loading, setLoading] = useState(true);

    const isSuperAdmin = user?.is_super_admin === true;

    // Fetch permissions whenever the active workspace changes
    useEffect(() => {
        const fetchPermissions = async () => {
            if (!isAuthenticated || !activeWorkspace) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const res = await authApi.getMyPermissions();
                if (res.data?.success) {
                    const perms = res.data.data?.permissions || res.data.permissions || [];
                    setPermissions(new Set(perms));
                }
            } catch (err) {
                console.error('Error fetching permissions:', err);
                setPermissions(new Set());
            } finally {
                setLoading(false);
            }
        };
        fetchPermissions();
    }, [isAuthenticated, activeWorkspace]);

    const hasPermission = useCallback((key) => {
        if (isSuperAdmin) return true;
        return permissions.has(key);
    }, [permissions, isSuperAdmin]);

    const hasAnyPermission = useCallback((keys) => {
        if (isSuperAdmin) return true;
        return keys.some(k => permissions.has(k));
    }, [permissions, isSuperAdmin]);

    const hasAllPermissions = useCallback((keys) => {
        if (isSuperAdmin) return true;
        return keys.every(k => permissions.has(k));
    }, [permissions, isSuperAdmin]);

    return (
        <PermissionContext.Provider value={{
            permissions,
            hasPermission,
            hasAnyPermission,
            hasAllPermissions,
            isSuperAdmin,
            loading,
        }}>
            {children}
        </PermissionContext.Provider>
    );
};

export const usePermissions = () => useContext(PermissionContext);
