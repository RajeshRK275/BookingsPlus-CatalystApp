import React from 'react';
import Topbar from './Topbar';
import Sidebar from './Sidebar';
import { Outlet } from 'react-router-dom';
import '../index.css';

const MainLayout = () => {
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
