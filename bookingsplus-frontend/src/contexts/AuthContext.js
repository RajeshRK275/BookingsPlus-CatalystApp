import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Mock authentication check on load
        const token = localStorage.getItem('token');
        if (token) {
            // we'd decode token or fetch profile here, stubbing for now:
            setUser({ id: 1, name: 'Admin', role: 'Admin', tenant_id: 'org123' });
        }
        setLoading(false);
    }, []);

    const login = async (email, password) => {
        // Stub implementation, would map to /api/v1/auth/login
        const mockUser = { id: 1, name: 'Admin', role: 'Admin', tenant_id: 'org123' };
        localStorage.setItem('token', 'mock_jwt_token');
        setUser(mockUser);
        return mockUser;
    };

    const logout = () => {
        localStorage.removeItem('token');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
