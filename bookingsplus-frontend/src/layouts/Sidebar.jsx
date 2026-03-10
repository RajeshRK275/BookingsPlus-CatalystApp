import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Calendar, Users, Grid, Settings, Briefcase, Bell, CheckSquare, ChevronDown } from 'lucide-react';

const navItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Appointments', path: '/appointments', icon: Calendar },
    { label: 'Services', path: '/services', icon: Grid },
    { label: 'Staff', path: '/staff', icon: Briefcase },
    { label: 'Customers', path: '/customers', icon: Users },
    { label: 'Notifications', path: '/notifications', icon: Bell },
    { label: 'Settings', path: '/settings', icon: Settings },
];

const Sidebar = () => {
    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <CheckSquare className="sidebar-logo-icon" size={24} />
                <span>Bookings</span>
            </div>
            
            <div className="org-switcher-container">
                <div className="org-switcher">
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div className="org-avatar">JI</div>
                        <span>JINS</span>
                    </div>
                    <ChevronDown size={14} />
                </div>
            </div>

            <nav className="nav-menu">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    return (
                        <NavLink 
                            key={item.path} 
                            to={item.path} 
                            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                        >
                            <Icon className="icon" size={18} />
                            <span>{item.label}</span>
                        </NavLink>
                    );
                })}
            </nav>
        </aside>
    );
};

export default Sidebar;
