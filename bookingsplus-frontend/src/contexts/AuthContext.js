import React, { createContext, useContext } from 'react';

const AuthContext = createContext(null);

// ─────────────────────────────────────────────────────────────
// Mock user — auth is disabled for now, all pages load directly.
// When auth is re-implemented later, this file will be replaced.
// ─────────────────────────────────────────────────────────────
const MOCK_USER = {
    id: 'dev-user-1',
    user_id: 'dev-user-1',
    name: 'Admin User',
    first_name: 'Admin',
    last_name: 'User',
    email_id: 'admin@bookingsplus.dev',
    role: 'Admin',
    tenant_id: 'dev-tenant-1',
    organization_id: 'dev-org-1',
};

export const AuthProvider = ({ children }) => {
    return (
        <AuthContext.Provider value={{
            user: MOCK_USER,
            isAuthenticated: true,
            loading: false,
            needsOnboarding: false,
            logout: () => {},
            refreshUser: () => Promise.resolve(),
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
