import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [needsOnboarding, setNeedsOnboarding] = useState(false);

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

    // Ensure all Axios calls catch 401/403 errors and properly force a logout
    useEffect(() => {
        const interceptor = axios.interceptors.response.use(
            response => response,
            error => {
                if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                    // Session expired or unauthorized -> Force fresh login
                    setUser(null);
                    window.location.href = '/app/login';
                }
                return Promise.reject(error);
            }
        );
        return () => axios.interceptors.response.eject(interceptor);
    }, []);

    const logout = () => {
        if (window.catalyst && window.catalyst.auth) {
            window.catalyst.auth.signOut().then(() => {
                setUser(null);
                setNeedsOnboarding(false);
                window.location.href = '/app/login';
            }).catch(() => {
                window.location.href = '/app/login';
            });
        } else {
            window.location.href = '/__catalyst/auth/logout';
        }
    };

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
