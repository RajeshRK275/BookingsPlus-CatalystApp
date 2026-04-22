import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Calendar, Users, Grid, Settings, Briefcase, ChevronDown, Plus, Check, Shield } from 'lucide-react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useAuth } from '../contexts/AuthContext';
import './Sidebar.css';

const Sidebar = () => {
    const { activeWorkspace, userWorkspaces, switchWorkspace } = useWorkspace();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef(null);

    const wsSlug = activeWorkspace?.workspace_slug || '';

    const navItems = [
        { label: 'Dashboard', path: `/ws/${wsSlug}`, icon: LayoutDashboard, exact: true },
        { label: 'Appointments', path: `/ws/${wsSlug}/appointments`, icon: Calendar },
        { label: 'Services', path: `/ws/${wsSlug}/services`, icon: Grid },
        { label: 'Employees', path: `/ws/${wsSlug}/employees`, icon: Briefcase },
        { label: 'Customers', path: `/ws/${wsSlug}/customers`, icon: Users },
        { label: 'Settings', path: `/ws/${wsSlug}/settings`, icon: Settings },
    ];

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSwitchWorkspace = (ws) => {
        switchWorkspace(ws.workspace_id);
        setShowDropdown(false);
        navigate(`/ws/${ws.workspace_slug}`);
    };

    const getWsInitial = (name) => name ? name.charAt(0).toUpperCase() : 'W';

    return (
        <aside className="sidebar">
            {/* Workspace Switcher */}
            <div className="org-switcher-container" style={{ marginTop: '8px', marginBottom: '8px', position: 'relative' }} ref={dropdownRef}>
                <div
                    className="org-switcher"
                    onClick={() => setShowDropdown(!showDropdown)}
                    style={{ background: '#f5f3ff', border: '1px solid #ede9fe', cursor: 'pointer' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                        <div className="org-avatar" style={{ background: activeWorkspace?.brand_color || '#a78bfa' }}>
                            {getWsInitial(activeWorkspace?.workspace_name)}
                        </div>
                        <span style={{ color: '#4c1d95', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {activeWorkspace?.workspace_name || 'Select Workspace'}
                        </span>
                    </div>
                    <ChevronDown size={14} color="#6B7280" style={{ flexShrink: 0, transition: 'transform 0.2s', transform: showDropdown ? 'rotate(180deg)' : 'none' }} />
                </div>

                {/* Dropdown */}
                {showDropdown && (
                    <div className="workspace-dropdown">
                        <div className="dropdown-header">
                            <div className="dropdown-icon-box">
                                <Shield size={16} />
                            </div>
                            <div className="dropdown-title">
                                <h4>Workspaces</h4>
                                <p>{userWorkspaces.length} workspace{userWorkspaces.length !== 1 ? 's' : ''}</p>
                            </div>
                        </div>

                        <div className="workspace-list-title">
                            <span>YOUR WORKSPACES</span>
                        </div>

                        {userWorkspaces.map(ws => {
                            const isActive = activeWorkspace && String(ws.workspace_id) === String(activeWorkspace.workspace_id);
                            return (
                                <div
                                    key={ws.workspace_id}
                                    className={`workspace-item ${isActive ? 'active' : ''}`}
                                    onClick={() => handleSwitchWorkspace(ws)}
                                >
                                    <div className="workspace-avatar" style={{ backgroundColor: ws.brand_color || '#a78bfa' }}>
                                        {getWsInitial(ws.workspace_name)}
                                    </div>
                                    <div className="workspace-info" style={{ flex: 1 }}>
                                        <h5>{ws.workspace_name}</h5>
                                        <p>{ws.role_name || 'Member'}</p>
                                    </div>
                                    {isActive && <Check size={16} color="var(--pk-primary)" />}
                                </div>
                            );
                        })}

                        {user?.is_super_admin && (
                            <div className="add-workspace-btn" onClick={() => { setShowDropdown(false); navigate('/admin/workspaces'); }}>
                                <Plus size={14} style={{ marginRight: '6px' }} />
                                New Workspace
                            </div>
                        )}
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
                            end={item.exact}
                            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                        >
                            <Icon className="icon" size={18} />
                            <span>{item.label}</span>
                        </NavLink>
                    );
                })}

                {/* Admin Console link for super admins */}
                {user?.is_super_admin && (
                    <NavLink
                        to="/admin"
                        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                        style={{ marginTop: '16px', borderTop: '1px solid var(--pk-border)', paddingTop: '16px' }}
                    >
                        <Shield className="icon" size={18} />
                        <span>Admin Console</span>
                    </NavLink>
                )}
            </nav>
        </aside>
    );
};

export default Sidebar;
