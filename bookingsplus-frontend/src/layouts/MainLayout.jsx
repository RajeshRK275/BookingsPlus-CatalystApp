import React, { useState, useCallback } from 'react';
import Topbar from './Topbar';
import Sidebar from './Sidebar';
import NotificationPanel from '../components/NotificationPanel';
import { Outlet } from 'react-router-dom';
import './MainLayout.css';

const MainLayout = () => {
    const [isNotifOpen, setIsNotifOpen] = useState(false);

    const handleToggleNotifications = useCallback(() => {
        setIsNotifOpen(prev => !prev);
    }, []);

    const handleCloseNotifications = useCallback(() => {
        setIsNotifOpen(false);
    }, []);

    return (
        <div className="layout-container">
            <Topbar
                onToggleNotifications={handleToggleNotifications}
                notificationCount={2}
            />
            <div className="layout-body">
                <Sidebar />
                <main className="main-content">
                    <Outlet />
                </main>
            </div>
            <NotificationPanel
                isOpen={isNotifOpen}
                onClose={handleCloseNotifications}
            />
        </div>
    );
};

export default MainLayout;
