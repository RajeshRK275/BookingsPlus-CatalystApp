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
import Settings from './pages/Settings';

// Query Client for API caching
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: { refetchOnWindowFocus: false, retry: 1 }
    }
});

/**
 * RootRedirect — Redirects / to /ws/:defaultWorkspaceSlug
 */
const RootRedirect = () => {
    const { activeWorkspace, loading: wsLoading } = useWorkspace();
    const { loading: authLoading, needsOnboarding } = useAuth();

    if (authLoading || wsLoading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Inter, sans-serif' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ width: '40px', height: '40px', border: '3px solid #E5E7EB', borderTopColor: '#5C44B5', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
                    <p style={{ color: '#6B7280', fontSize: '14px' }}>Loading...</p>
                </div>
            </div>
        );
    }

    if (needsOnboarding) {
        return <Navigate to="/setup" replace />;
    }

    if (activeWorkspace?.workspace_slug) {
        return <Navigate to={`/ws/${activeWorkspace.workspace_slug}`} replace />;
    }

    return <Navigate to="/setup" replace />;
};

/**
 * SetupPage — Simple placeholder for onboarding. Will be enhanced later.
 */
const SetupPage = () => {
    const { user } = useAuth();
    const [orgName, setOrgName] = React.useState('');
    const [wsName, setWsName] = React.useState('');
    const [submitting, setSubmitting] = React.useState(false);
    const [done, setDone] = React.useState(false);

    const handleSetup = async (e) => {
        e.preventDefault();
        if (!orgName) return;
        setSubmitting(true);
        try {
            const axios = (await import('axios')).default;
            await axios.post('/server/bookingsplus/api/v1/organizations/setup', {
                organization_name: orgName,
                workspace_name: wsName || orgName,
            });
            setDone(true);
            setTimeout(() => window.location.reload(), 1500);
        } catch (err) {
            alert('Setup failed: ' + (err.response?.data?.message || err.message));
        } finally {
            setSubmitting(false);
        }
    };

    if (done) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Inter, sans-serif' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ width: '64px', height: '64px', backgroundColor: '#DCFCE7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                    <h2 style={{ fontSize: '20px', marginBottom: '8px' }}>Setup Complete!</h2>
                    <p style={{ color: '#6B7280' }}>Redirecting to your workspace...</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Inter, sans-serif', backgroundColor: '#F9FAFB' }}>
            <div style={{ width: '100%', maxWidth: '480px', backgroundColor: 'white', borderRadius: '16px', padding: '40px', border: '1px solid #E5E7EB', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px', textAlign: 'center' }}>Welcome to Bookings+</h1>
                <p style={{ color: '#6B7280', textAlign: 'center', marginBottom: '32px' }}>
                    Let's set up your organization, {user?.name || 'Admin'}.
                </p>
                <form onSubmit={handleSetup}>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Organization Name *</label>
                        <input type="text" required value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="Acme Education Group" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '15px', outline: 'none' }} />
                    </div>
                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>First Workspace Name</label>
                        <input type="text" value={wsName} onChange={e => setWsName(e.target.value)} placeholder={orgName || 'Main Branch'} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '15px', outline: 'none' }} />
                        <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '4px' }}>Defaults to organization name if left empty.</p>
                    </div>
                    <button type="submit" disabled={submitting} style={{ width: '100%', padding: '12px', backgroundColor: '#5C44B5', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
                        {submitting ? 'Setting up...' : 'Create Organization'}
                    </button>
                </form>
            </div>
        </div>
    );
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
            <Route path="/setup" element={<SetupPage />} />

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
                <Route path="customers" element={<div style={{ padding: '40px' }}><h1>Customers Page</h1><p style={{ color: '#6B7280' }}>Coming soon.</p></div>} />
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

