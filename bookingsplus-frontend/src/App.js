import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { WorkspaceProvider, useWorkspace } from './contexts/WorkspaceContext';
import { PermissionProvider } from './contexts/PermissionContext';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import Services from './pages/Services';
import ServiceDetail from './pages/ServiceDetail';
import PublicBooking from './pages/PublicBooking';
import Appointments from './pages/Appointments';
import Calendar from './pages/Calendar';
import Employees from './pages/Employees';
import EmployeeDetail from './pages/EmployeeDetail';
import Customers from './pages/Customers';
import Settings from './pages/Settings';
import Onboarding from './pages/Onboarding';

// Query Client for API caching
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: { refetchOnWindowFocus: false, retry: 1 }
    }
});

/**
 * LoadingScreen — Shared loading spinner for route transitions
 */
const LoadingScreen = () => (
    <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh',
        fontFamily: "'Inter', -apple-system, sans-serif", backgroundColor: '#F9FAFB',
    }}>
        <div style={{ textAlign: 'center' }}>
            <div style={{
                width: '40px', height: '40px', border: '3px solid #E5E7EB', borderTopColor: '#5C44B5',
                borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
            }} />
            <p style={{ color: '#6B7280', fontSize: '14px' }}>Loading...</p>
        </div>
    </div>
);

/**
 * WorkspaceNotReadyScreen — Shown to non-admin users when no org setup data exists.
 * This is the "Kishore screen" — a friendly message telling them to contact their admin.
 */
const WorkspaceNotReadyScreen = ({ needsOnboarding }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: "'Inter', sans-serif", backgroundColor: '#F9FAFB' }}>
        <div style={{ textAlign: 'center', maxWidth: '440px', padding: '40px' }}>
            <div style={{ 
                width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#F3F0FF',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
            }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#5C44B5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '12px', color: '#111827' }}>Workspace Not Ready</h2>
            <p style={{ color: '#6B7280', fontSize: '14px', lineHeight: '1.7' }}>
                {needsOnboarding
                    ? "Your organization hasn't been set up yet. Please contact your administrator to complete the initial setup."
                    : "Unable to load your workspace. Please try refreshing the page or contact your administrator."
                }
            </p>
            <button 
                onClick={() => window.location.reload()} 
                style={{
                    marginTop: '20px', padding: '10px 28px', backgroundColor: '#5C44B5', color: 'white',
                    border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                    fontFamily: "'Inter', sans-serif", transition: 'background-color 0.2s',
                }}
                onMouseOver={e => e.target.style.backgroundColor = '#4C3A9A'}
                onMouseOut={e => e.target.style.backgroundColor = '#5C44B5'}
            >
                Refresh Page
            </button>
        </div>
    </div>
);

/**
 * SessionExpiredScreen — Shown when the user's Catalyst session has expired.
 * The API interceptor should auto-redirect to login, but if that fails,
 * this screen provides a manual fallback.
 */
const SessionExpiredScreen = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: "'Inter', sans-serif", backgroundColor: '#F9FAFB' }}>
        <div style={{ textAlign: 'center', maxWidth: '440px', padding: '40px' }}>
            <div style={{ 
                width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#FEF3C7',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
            }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '12px', color: '#111827' }}>Session Expired</h2>
            <p style={{ color: '#6B7280', fontSize: '14px', lineHeight: '1.7', marginBottom: '8px' }}>
                Your session has expired. Please log in again to continue.
            </p>
            <p style={{ color: '#9CA3AF', fontSize: '12px', lineHeight: '1.5', marginBottom: '20px' }}>
                Redirecting to login page...
            </p>
            <button 
                onClick={() => { window.location.href = '/__catalyst/auth/login'; }} 
                style={{
                    marginTop: '8px', padding: '10px 28px', backgroundColor: '#5C44B5', color: 'white',
                    border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                    fontFamily: "'Inter', sans-serif", transition: 'background-color 0.2s',
                }}
                onMouseOver={e => e.target.style.backgroundColor = '#4C3A9A'}
                onMouseOut={e => e.target.style.backgroundColor = '#5C44B5'}
            >
                Log In
            </button>
        </div>
    </div>
);

/**
 * RootRedirect — Redirects / to the correct destination:
 * - If not authenticated (401) → Session Expired screen (auto-redirects to login)
 * - If needs onboarding (super admin, no org) → /setup
 * - If has workspace → /ws/:slug
 * - Non-admins without workspace → friendly "Workspace Not Ready" screen
 */
const RootRedirect = () => {
    const { activeWorkspace, loading: wsLoading } = useWorkspace();
    const { loading: authLoading, needsOnboarding, user, isAuthenticated } = useAuth();

    console.log('[RootRedirect] Rendering with:', {
        authLoading, wsLoading, needsOnboarding,
        isAuthenticated,
        is_super_admin: user?.is_super_admin,
        user_email: user?.email,
        activeWorkspace: activeWorkspace?.workspace_slug,
    });

    if (authLoading || wsLoading) {
        return <LoadingScreen />;
    }

    // NOT AUTHENTICATED — session expired or user not logged in.
    // The API interceptor should auto-redirect to Catalyst login,
    // but show a fallback screen in case the redirect hasn't kicked in yet.
    if (!isAuthenticated) {
        console.log('[RootRedirect] → Not authenticated, showing session expired screen');
        return <SessionExpiredScreen />;
    }

    // Super admin + no org setup → redirect to setup wizard
    // NOTE: needsOnboarding = isAuthenticated && !setupCompleted
    if (needsOnboarding && user?.is_super_admin === true) {
        console.log('[RootRedirect] → Redirecting admin to /setup');
        return <Navigate to="/setup" replace />;
    }

    // Has a valid workspace → go to dashboard
    if (activeWorkspace?.workspace_slug) {
        return <Navigate to={`/ws/${activeWorkspace.workspace_slug}`} replace />;
    }

    // If needs onboarding but user is NOT super admin → Kishore's screen
    if (needsOnboarding && !user?.is_super_admin) {
        console.log('[RootRedirect] → Non-admin user, org not set up yet');
        return <WorkspaceNotReadyScreen needsOnboarding={true} />;
    }

    // User is super admin but has no workspaces (org might exist but workspace deleted)
    if (user?.is_super_admin === true) {
        console.log('[RootRedirect] → Super admin with no workspace, sending to /setup');
        return <Navigate to="/setup" replace />;
    }

    // ══════════════════════════════════════════════════════════════
    // SAFETY NET: If the user is authenticated, org exists (setupCompleted=true),
    // but they have NO workspaces and is_super_admin=false — something is wrong.
    // This can happen when:
    //   1. Datastore was partially cleared (org exists but workspaces/memberships don't)
    //   2. The user's is_super_admin flag was lost during data migration
    //   3. No UserWorkspaces membership exists for this user
    //
    // In this case, redirect to /setup anyway — the OnboardingGuard will handle
    // showing the right thing. The backend auto-fix will promote the sole user
    // to super admin on the next /auth/me call.
    // ══════════════════════════════════════════════════════════════
    if (isAuthenticated && !activeWorkspace) {
        console.log('[RootRedirect] → Authenticated user with no workspace, redirecting to /setup for recovery');
        return <Navigate to="/setup" replace />;
    }

    // Non-admin user, org exists but no workspace assigned → show friendly screen
    console.log('[RootRedirect] → Fallback: showing WorkspaceNotReadyScreen');
    return <WorkspaceNotReadyScreen needsOnboarding={false} />;
};

/**
 * WorkspaceGuard — Wraps ALL /ws/:wsSlug routes.
 * 
 * Checks needsOnboarding on EVERY workspace route render, so even if
 * the admin is deep in /ws/some-slug/services and refreshes after clearing
 * the datastore, they get redirected to /setup immediately.
 * 
 * Non-admin users see the "Workspace Not Ready" screen.
 */
const WorkspaceGuard = () => {
    const { loading: authLoading, needsOnboarding, user, isAuthenticated } = useAuth();
    const { loading: wsLoading } = useWorkspace();

    console.log('[WorkspaceGuard] Rendering with:', {
        authLoading, wsLoading, needsOnboarding,
        isAuthenticated,
        is_super_admin: user?.is_super_admin,
    });

    if (authLoading || wsLoading) {
        return <LoadingScreen />;
    }

    // No org setup data exists — intercept before rendering MainLayout
    if (needsOnboarding) {
        // Admin → redirect to setup wizard
        if (user?.is_super_admin === true) {
            console.log('[WorkspaceGuard] → Admin + needsOnboarding, redirecting to /setup');
            return <Navigate to="/setup" replace />;
        }
        // Non-admin → show the "Workspace Not Ready" screen
        console.log('[WorkspaceGuard] → Non-admin + needsOnboarding, showing WorkspaceNotReady');
        return <WorkspaceNotReadyScreen needsOnboarding={true} />;
    }

    // Org exists, setup is complete → render the normal MainLayout
    return <MainLayout />;
};

/**
 * OnboardingGuard — Shows the onboarding wizard ONLY for super admins
 * who haven't completed organization setup yet.
 * 
 * Non-admin users are NEVER shown the onboarding wizard.
 * They get a friendly message asking them to contact their admin.
 */
const OnboardingGuard = () => {
    const { loading: authLoading, needsOnboarding, setupCompleted, user, refreshUser } = useAuth();
    const { activeWorkspace, loading: wsLoading, userWorkspaces } = useWorkspace();

    if (authLoading || wsLoading) {
        return <LoadingScreen />;
    }

    // If user is NOT super admin but has no workspace → they ended up here
    // as a safety net redirect. Show a recovery-friendly message.
    // NOTE: The backend auto-fix should promote the sole user to super admin,
    // so a page refresh should fix this.
    if (!user?.is_super_admin) {
        // If they have a workspace, just redirect there
        if (activeWorkspace?.workspace_slug) {
            return <Navigate to={`/ws/${activeWorkspace.workspace_slug}`} replace />;
        }

        // No workspace AND not admin — this is the "data is broken" scenario.
        // Instead of showing "contact your admin" (they ARE the admin), show a
        // recovery message that refreshes and triggers the backend auto-fix.
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: "'Inter', sans-serif", backgroundColor: '#F9FAFB' }}>
                <div style={{ textAlign: 'center', maxWidth: '440px', padding: '40px' }}>
                    <div style={{ 
                        width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#FEF3C7',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
                    }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                    </div>
                    <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '12px', color: '#111827' }}>Setting Up Your Account</h2>
                    <p style={{ color: '#6B7280', fontSize: '14px', lineHeight: '1.7' }}>
                        Your workspace configuration needs to be initialized. Click below to refresh and complete the setup.
                    </p>
                    <button 
                        onClick={() => window.location.reload()} 
                        style={{
                            marginTop: '20px', padding: '10px 28px', backgroundColor: '#5C44B5', color: 'white',
                            border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                            fontFamily: "'Inter', sans-serif", transition: 'background-color 0.2s',
                        }}
                        onMouseOver={e => e.target.style.backgroundColor = '#4C3A9A'}
                        onMouseOut={e => e.target.style.backgroundColor = '#5C44B5'}
                    >
                        Refresh & Setup
                    </button>
                </div>
            </div>
        );
    }

    // Super admin — org not created yet → show wizard
    if (needsOnboarding) {
        return <Onboarding />;
    }

    // Super admin — org exists but onboarding wizard wasn't completed fully
    const onboardingDone = localStorage.getItem('bp_onboarding_completed') === 'true';
    if (setupCompleted && !onboardingDone) {
        return <Onboarding />;
    }

    // Everything is set up — go to dashboard
    if (setupCompleted && activeWorkspace?.workspace_slug) {
        return <Navigate to={`/ws/${activeWorkspace.workspace_slug}`} replace />;
    }

    // Super admin, setup completed but no workspace — show wizard to create one
    if (setupCompleted && (!userWorkspaces || userWorkspaces.length === 0)) {
        return <Onboarding />;
    }

    // Fallback: show wizard for super admin
    return <Onboarding />;
};

/**
 * AdminPlaceholder — Simple admin console placeholder
 */
const AdminPlaceholder = () => (
    <div style={{ padding: '40px', fontFamily: 'Inter, sans-serif' }}>
        <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>Admin Console</h1>
        <p style={{ color: '#6B7280' }}>Workspace management, user management, roles & permissions, and audit logs will be built here.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginTop: '24px' }}>
            {['Workspaces', 'Users', 'Roles & Permissions', 'Audit Log'].map(item => (
                <div key={item} style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', border: '1px solid #E5E7EB' }}>
                    <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>{item}</h3>
                    <p style={{ fontSize: '13px', color: '#6B7280' }}>Manage {item.toLowerCase()} across all workspaces.</p>
                </div>
            ))}
        </div>
    </div>
);

function AppRoutes() {
    return (
        <Routes>
            {/* Public routes (no auth/workspace needed) */}
            <Route path="/book/:serviceId" element={<PublicBooking />} />

            {/* Onboarding wizard — full-screen multi-step setup */}
            <Route path="/setup" element={<OnboardingGuard />} />

            {/* Root redirect */}
            <Route path="/" element={<RootRedirect />} />

            {/* Service detail (standalone page) */}
            <Route path="/ws/:wsSlug/services/:serviceId" element={<ServiceDetail />} />

            {/* Admin routes */}
            <Route path="/admin" element={<AdminPlaceholder />} />
            <Route path="/admin/*" element={<AdminPlaceholder />} />

            {/* Workspace-scoped routes — guarded by WorkspaceGuard */}
            <Route path="/ws/:wsSlug" element={<WorkspaceGuard />}>
                <Route index element={<Dashboard />} />
                <Route path="appointments" element={<Appointments />} />
                <Route path="calendar" element={<Calendar />} />
                <Route path="services" element={<Services />} />
                <Route path="employees" element={<Employees />} />
                <Route path="employees/:employeeId" element={<EmployeeDetail />} />
                <Route path="customers" element={<Customers />} />
                <Route path="settings" element={<Settings />} />
            </Route>

            {/* Legacy routes — redirect to workspace-scoped */}
            <Route path="/appointments" element={<RootRedirect />} />
            <Route path="/services" element={<RootRedirect />} />
            <Route path="/employees" element={<RootRedirect />} />
            <Route path="/settings" element={<RootRedirect />} />
            <Route path="/calendar" element={<RootRedirect />} />

            {/* Catch-all */}
            <Route path="*" element={<RootRedirect />} />
        </Routes>
    );
}

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <Router>
                <AuthProvider>
                    <WorkspaceProvider>
                        <PermissionProvider>
                            <AppRoutes />
                        </PermissionProvider>
                    </WorkspaceProvider>
                </AuthProvider>
            </Router>
        </QueryClientProvider>
    );
}

export default App;

