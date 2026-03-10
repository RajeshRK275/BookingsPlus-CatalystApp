import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const Dashboard = () => {
    const { user } = useAuth();

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">Welcome back, {user?.name}</h1>
                <p className="page-subtitle">Here is what is happening with your organization today.</p>
            </div>
            
            <div className="dashboard-widgets">
                <div className="card stat-card">
                    <div className="stat-value">12</div>
                    <div className="stat-label">Appointments Today</div>
                </div>
                <div className="card stat-card">
                    <div className="stat-value">5</div>
                    <div className="stat-label">Pending Approvals</div>
                </div>
                <div className="card stat-card">
                    <div className="stat-value">$450</div>
                    <div className="stat-label">Revenue Today</div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
