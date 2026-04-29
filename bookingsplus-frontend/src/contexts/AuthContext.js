import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../services';
import { STORAGE_KEYS } from '../constants';

const AuthContext = createContext(null);

/**
 * Normalize is_super_admin to a consistent boolean value.
 * Backend may return: boolean true/false, string "true"/"false", or 1/0.
 */
const normalizeSuperAdmin = (value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    if (typeof value === 'number') return value === 1;
    return false;
};

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

    const refreshUser = useCallback(async (retryCount = 0) => {
        try {
            console.log(`[AuthContext] Calling /auth/me (attempt ${retryCount + 1}/3)...`);
            const res = await authApi.getMe();
            console.log('[AuthContext] /auth/me response:', JSON.stringify(res.data));

            if (res.data?.success && res.data.data?.user) {
                const userData = res.data.data.user;
                userData.is_super_admin = normalizeSuperAdmin(userData.is_super_admin);

                console.log('[AuthContext] User loaded:', userData.email, '| is_super_admin:', userData.is_super_admin, '| setupCompleted:', res.data.data.setupCompleted);

                setUser(userData);
                setIsAuthenticated(true);
                setSetupCompleted(res.data.data.setupCompleted === true);
            } else {
                console.warn('[AuthContext] /auth/me returned success but no user data:', res.data);
                setUser({ name: 'Admin', email: '', is_super_admin: true, _isFallback: true });
                setIsAuthenticated(true);
                setSetupCompleted(false);
            }
        } catch (err) {
            console.error('[AuthContext] Auth check failed:', err);

            const status = err.status || err.response?.status;
            const errMsg = err.data?.message || err.response?.data?.message || err.message || '';
            const errCode = err.data?.code || err.response?.data?.code || '';
            const isTimeout = errMsg.toLowerCase().includes('timeout') || errCode === 'ECONNABORTED';
            const isNetworkError = !status && (errMsg.toLowerCase().includes('network') || errCode === 'ERR_NETWORK');

            console.warn(`[AuthContext] Error status=${status}, message="${errMsg}", code="${errCode}", isTimeout=${isTimeout}, isNetworkError=${isNetworkError}`);

            if (status === 401) {
                console.log('[AuthContext] 401 — session expired, redirecting to Catalyst login...');
                setUser(null);
                setIsAuthenticated(false);
                window.location.href = '/__catalyst/auth/login';
                return;
            }

            // TIMEOUT / NETWORK ERROR HANDLING:
            // Catalyst serverless cold starts can take 15-25s on the FIRST request.
            // After cold start, subsequent requests are fast (~1-2s).
            // Retry up to 2 more times (3 total attempts) before giving up.
            if ((isTimeout || isNetworkError) && retryCount < 2) {
                const delay = (retryCount + 1) * 2000; // 2s, then 4s
                console.warn(`[AuthContext] Timeout/network error on /auth/me — retrying in ${delay/1000}s (attempt ${retryCount + 2}/3)...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return refreshUser(retryCount + 1);
            }

            // Non-401, non-retryable error — treat as first-time setup
            console.warn(`[AuthContext] Non-401 error after ${retryCount + 1} attempts (status=${status}) — treating as first-time setup mode`);
            setUser({ name: 'Admin', email: '', is_super_admin: true, _isFallback: true });
            setIsAuthenticated(true);
            setSetupCompleted(false);
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
