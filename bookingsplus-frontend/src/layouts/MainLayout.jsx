import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import Topbar from './Topbar';
import Sidebar from './Sidebar';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import '../index.css';

const MainLayout = () => {
    const { isAuthenticated, loading, needsOnboarding } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '100vh', fontSize: '16px', color: '#6B7280',
                fontFamily: '"Inter", sans-serif'
            }}>
                Loading BookingsPlus…
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    if (needsOnboarding) {
        return <Navigate to="/onboarding" replace />;
    }

    return (
        <div className="layout-container">
            <Topbar />
            <div className="layout-body">
                <Sidebar />
                <main className="main-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
