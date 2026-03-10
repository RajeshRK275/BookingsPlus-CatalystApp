import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import Topbar from './Topbar';
import Sidebar from './Sidebar';
import { Outlet, Navigate } from 'react-router-dom';
import '../index.css'; // Assume Zoho styles are here

const MainLayout = () => {
    const { isAuthenticated, loading } = useAuth();

    if (loading) return <div className="loading-screen">Loading BookingsPlus...</div>;
    
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
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
