import React from 'react';
import { Bell, Calendar, User, Settings, CheckSquare } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Topbar = () => {
    const { user, logout } = useAuth();

    return (
        <header className="topbar">
            <div className="topbar-left" style={{ display: 'flex', alignItems: 'center', width: 'var(--pk-sidebar-width)' }}>
                <CheckSquare className="brand-logo-icon" size={24} color="var(--pk-primary)" style={{ marginRight: '8px' }} />
                <div className="brand-logo" style={{ margin: 0, color: 'var(--pk-text-main)' }}>Bookings</div>
            </div>
            
            <div className="topbar-right" style={{ flex: 1, justifyContent: 'flex-end' }}>
                <button className="quick-add-btn" style={{ marginRight: '8px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                </button>
                <button className="icon-btn" title="Calendar"><Calendar size={20} /></button>
                <button className="icon-btn" title="Notifications"><Bell size={20} /></button>
                <button className="icon-btn" title="Settings"><Settings size={20} /></button>
                <div className="user-profile" onClick={logout} title={user?.name}>
                    <User size={18} />
                </div>
            </div>
        </header>
    );
};

export default Topbar;
