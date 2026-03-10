import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Calendar, Users, Grid, Settings, Briefcase, Bell, ChevronDown, CheckSquare, Search } from 'lucide-react';

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
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    return (
        <aside className="sidebar">
            <div className="org-switcher-container" style={{ marginTop: '8px', marginBottom: '8px', position: 'relative' }}>
                <div 
                    className="org-switcher" 
                    style={{ background: '#f5f3ff', border: '1px solid #ede9fe' }}
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div className="org-avatar" style={{ background: '#a78bfa' }}>JI</div>
                        <span style={{ color: '#4c1d95' }}>JINS</span>
                    </div>
                    <ChevronDown size={14} color="#7c3aed" />
                </div>
                
                {isDropdownOpen && (
                    <div className="workspace-dropdown">
                        <div className="dropdown-header">
                            <div className="dropdown-icon-box">
                                <CheckSquare size={16} />
                            </div>
                            <div className="dropdown-title">
                                <h4>My Space</h4>
                                <p>Unified view of all Workspaces</p>
                            </div>
                        </div>

                        <div className="workspace-list-title">
                            <span>SWITCH WORKSPACES</span>
                            <Search size={12} cursor="pointer" />
                        </div>

                        <div className="workspace-item active">
                            <div className="workspace-avatar" style={{ background: '#a78bfa' }}>JI</div>
                            <div className="workspace-info">
                                <h5>JINS</h5>
                                <p>30 Services</p>
                            </div>
                        </div>

                        <div className="workspace-item">
                            <div className="workspace-avatar" style={{ background: '#6ee7b7' }}>SU</div>
                            <div className="workspace-info">
                                <h5>Sunmarke</h5>
                                <p>11 Services</p>
                            </div>
                        </div>

                        <div className="workspace-item">
                            <div className="workspace-avatar" style={{ background: '#fca5a5' }}>PR</div>
                            <div className="workspace-info">
                                <h5>Property</h5>
                                <p>2 Services</p>
                            </div>
                        </div>

                        <div className="add-workspace-btn">
                            + New workspace
                        </div>
                    </div>
                )}
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
