import React from 'react';
import { Bell, Calendar, User, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { Link } from 'react-router-dom';
import logo from '../assets/logo192.png';
import './Topbar.css';

const Topbar = ({ onToggleNotifications, notificationCount }) => {
    const { user, logout } = useAuth();
    const { activeWorkspace } = useWorkspace();

    const wsSlug = activeWorkspace?.workspace_slug || '';

    return (
        <header className="topbar">
            <div className="topbar-left" style={{ display: 'flex', alignItems: 'center', width: 'var(--pk-sidebar-width)' }}>
                <img src={logo} alt="BookingsPlus" className="brand-logo-icon" style={{ width: '28px', height: '28px', marginRight: '8px', borderRadius: '6px' }} />
                <div className="brand-logo" style={{ margin: 0, color: 'var(--pk-text-main)' }}>Bookings+</div>
            </div>

            <div className="topbar-right" style={{ flex: 1, justifyContent: 'flex-end' }}>
                <button className="quick-add-btn" style={{ marginRight: '8px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                </button>
                <Link to={wsSlug ? `/ws/${wsSlug}/calendar` : '/calendar'} style={{ textDecoration: 'none', color: 'inherit', display: 'flex' }}>
                    <button className="icon-btn" title="Calendar"><Calendar size={20} /></button>
                </Link>
                <button
                    className="icon-btn notif-bell-btn"
                    title="Notifications"
                    onClick={onToggleNotifications}
                >
                    <Bell size={20} />
                    {notificationCount > 0 && (
                        <span className="notif-bell-badge">{notificationCount}</span>
                    )}
                </button>
                <Link to={wsSlug ? `/ws/${wsSlug}/settings` : '/settings'} style={{ textDecoration: 'none', color: 'inherit', display: 'flex' }}>
                    <button className="icon-btn" title="Settings"><Settings size={20} /></button>
                </Link>
                <div className="user-profile" title={user?.name || 'User'} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <User size={18} />
                </div>
                <button className="icon-btn" title="Logout" onClick={logout} style={{ marginLeft: '4px' }}>
                    <LogOut size={18} />
                </button>
            </div>
        </header>
    );
};

export default Topbar;
