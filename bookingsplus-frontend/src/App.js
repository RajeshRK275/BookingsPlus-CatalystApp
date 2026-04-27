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
 * RootRedirect — Redirects / to the correct destination:
 * - If needs onboarding (super admin, no org) → /setup
 * - If has workspace → /ws/:slug
 * - Non-admins without workspace → friendly message
 */
const RootRedirect = () => {
    const { activeWorkspace, loading: wsLoading } = useWorkspace();
    const { loading: authLoading, needsOnboarding, user } = useAuth();

    if (authLoading || wsLoading) {
        return <LoadingScreen />;
    }

    // Only super admins who haven't set up the org go to /setup
    if (needsOnboarding && user?.is_super_admin) {
        return <Navigate to="/setup" replace />;
    }

    if (activeWorkspace?.workspace_slug) {
        return <Navigate to={`/ws/${activeWorkspace.workspace_slug}`} replace />;
    }

    // If not super admin and no workspace, show a friendly message
    if (needsOnboarding && !user?.is_super_admin) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: "'Inter', sans-serif" }}>
                <div style={{ textAlign: 'center', maxWidth: '400px', padding: '40px' }}>
                    <h2 style={{ fontSize: '20px', marginBottom: '12px' }}>Workspace Not Ready</h2>
                    <p style={{ color: '#6B7280', fontSize: '14px', lineHeight: '1.6' }}>
                        Your organization hasn't been set up yet. Please contact your administrator to complete the setup.
                    </p>
                </div>
            </div>
        );
    }

    return <Navigate to="/setup" replace />;
};

/**
 * OnboardingGuard — Shows the onboarding wizard ONLY for super admins
 * who haven't completed organization setup yet.
 * 
 * Non-admin users are NEVER shown the onboarding wizard.
 * They get a friendly message asking them to contact their admin.
 */
const OnboardingGuard = () => {
    const { loading: authLoading, needsOnboarding, setupCompleted, user } = useAuth();
    const { activeWorkspace, loading: wsLoading } = useWorkspace();

    if (authLoading || wsLoading) {
        return <LoadingScreen />;
    }

    // Non-super-admins should NEVER see the onboarding wizard
    if (!user?.is_super_admin) {
        if (activeWorkspace?.workspace_slug) {
            return <Navigate to={`/ws/${activeWorkspace.workspace_slug}`} replace />;
        }
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: "'Inter', sans-serif" }}>
                <div style={{ textAlign: 'center', maxWidth: '400px', padding: '40px' }}>
                    <h2 style={{ fontSize: '20px', marginBottom: '12px' }}>Workspace Not Ready</h2>
                    <p style={{ color: '#6B7280', fontSize: '14px', lineHeight: '1.6' }}>
                        Your organization hasn't been set up yet. Please contact your administrator to complete the setup.
                    </p>
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

            {/* Workspace-scoped routes (main layout) */}
            <Route path="/ws/:wsSlug" element={<MainLayout />}>
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

