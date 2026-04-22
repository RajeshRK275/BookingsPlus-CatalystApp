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
            // In Catalyst deployed mode, a 401 means the user needs to log in.
            // Catalyst embedded auth will handle the redirect automatically.
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

    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated,
            loading,
            setupCompleted,
            needsOnboarding: isAuthenticated && !setupCompleted,
            logout,
            refreshUser,
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
