import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../services';
import { STORAGE_KEYS } from '../constants';

const AuthContext = createContext(null);

/**
 * AuthProvider — Uses Catalyst Embedded Authentication.
 * 
 * On mount, calls GET /api/v1/auth/me to get the authenticated user.
 * In production (Catalyst), the session cookie is sent automatically.
 * If the user is not authenticated, Catalyst redirects to the login page.
 * 
 * The user object includes: user_id, name, email, is_super_admin, role_version.
 * Also returns setupCompleted flag to determine if onboarding is needed.
 */
export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);
    const [setupCompleted, setSetupCompleted] = useState(false);

    const refreshUser = useCallback(async () => {
        try {
            const res = await authApi.getMe();
            if (res.data?.success && res.data.data?.user) {
                setUser(res.data.data.user);
                setIsAuthenticated(true);
                setSetupCompleted(res.data.data.setupCompleted || false);
            } else {
                setUser(null);
                setIsAuthenticated(false);
            }
        } catch (err) {
            console.error('Auth check failed:', err);

            // Extract status and message from various error shapes
            const status = err.status || err.response?.status;
            const errMsg = err.data?.message || err.response?.data?.message || err.message || '';
            const errCode = err.data?.code || err.response?.data?.code || '';

            if (status === 401) {
                // 401 — user not logged in. Catalyst embedded auth handles redirect.
                setUser(null);
                setIsAuthenticated(false);
                return;
            }

            // Server errors (500/502/503) during auth check almost always mean:
            // - Organization table is empty (first-time setup)
            // - Data Store tables/columns are missing
            // - Setup hasn't been completed
            // Instead of showing a blank/broken screen, redirect to setup page.
            if (status >= 500) {
                console.warn(`Server error (${status}) during auth — showing setup page. Error: ${errMsg} [${errCode}]`);
                setUser({ name: 'Admin', email: '', is_super_admin: true });
                setIsAuthenticated(true);
                setSetupCompleted(false);
                return;
            }

            // Any other error — unauthenticated state
            setUser(null);
            setIsAuthenticated(false);
        }
    }, []);

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            await refreshUser();
            setLoading(false);
        };
        init();
    }, [refreshUser]);

    const logout = useCallback(() => {
        // In Catalyst, logout is handled via the Catalyst SDK / page redirect
        setUser(null);
        setIsAuthenticated(false);
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_WORKSPACE);
        window.location.href = '/__catalyst/auth/login';
    }, []);

    /**
     * Mark setup as completed (called after org creation in the onboarding wizard).
     * This allows the wizard to proceed to subsequent steps without
     * needsOnboarding flipping back to false mid-flow.
     */
    const markSetupComplete = React.useCallback(() => {
        setSetupCompleted(true);
    }, []);

    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated,
            loading,
            setupCompleted,
            needsOnboarding: isAuthenticated && !setupCompleted,
            logout,
            refreshUser,
            markSetupComplete,
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
