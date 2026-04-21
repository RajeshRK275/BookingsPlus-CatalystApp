import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [needsOnboarding, setNeedsOnboarding] = useState(false);
    const navigate = useNavigate();
    const interceptorSet = useRef(false);

    const fetchUser = useCallback(async () => {
        try {
            const res = await axios.get('/server/bookingsplus/api/v1/auth/me');
            if (res.data.success && res.data.user) {
                if (res.data.needsOnboarding) {
                    setNeedsOnboarding(true);
                    setUser(res.data.user);
                } else {
                    setNeedsOnboarding(false);
                    setUser({
                        ...res.data.user,
                        id: res.data.user.user_id,
                        name: `${res.data.user.first_name || ''} ${res.data.user.last_name || ''}`.trim() || res.data.user.email_id,
                        role: res.data.user.role || 'Admin',
                        tenant_id: res.data.user.tenant_id,
                    });
                }
            } else {
                setUser(null);
            }
        } catch {
            // 401 = not authenticated, this is expected for unauthenticated users
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUser();
    }, [fetchUser]);

    // Axios interceptor — set up once and never re-register
    useEffect(() => {
        if (interceptorSet.current) return;
        interceptorSet.current = true;

        axios.interceptors.response.use(
            response => response,
            error => {
                if (error.response && error.response.status === 401) {
                    // Session expired → clear state; the <Navigate> in MainLayout
                    // will push the user to /login without a hard reload.
                    setUser(null);
                    setNeedsOnboarding(false);
                }
                return Promise.reject(error);
            }
        );
    }, []);

    const logout = useCallback(async () => {
        try {
            // Try Catalyst SDK sign-out (clears the session cookie)
            if (window.catalyst && window.catalyst.auth) {
                await window.catalyst.auth.signOut();
            }
        } catch (e) {
            console.warn('Catalyst signOut error (non-fatal):', e);
        }
        // Clear React state
        setUser(null);
        setNeedsOnboarding(false);
        // Navigate inside the SPA — no hard reload needed
        navigate('/login', { replace: true });
    }, [navigate]);

    return (
        <AuthContext.Provider value={{
            user,
            logout,
            isAuthenticated: !!user,
            loading,
            needsOnboarding,
            refreshUser: fetchUser,
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
