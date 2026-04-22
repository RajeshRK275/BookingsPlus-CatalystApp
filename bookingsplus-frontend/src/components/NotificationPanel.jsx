import React, { useState, useRef, useEffect } from 'react';
import { X, Calendar, User, Settings, ChevronDown, CreditCard, Link2, Grid } from 'lucide-react';

const CATEGORIES = [
    { key: 'all', label: 'All' },
    { key: 'connections', label: 'Connections' },
    { key: 'appointments', label: 'Appointments' },
    { key: 'users', label: 'Users' },
    { key: 'event_types', label: 'Event Types' },
    { key: 'payment', label: 'Payment' },
];

const SAMPLE_NOTIFICATIONS = [
    {
        id: 1,
        category: 'appointments',
        message: 'Customer, Martha Johnson has scheduled an appointment with Jason Miller for Whole School Tour.',
        timestamp: '24-Mar-2026 04:38 pm',
        read: false,
    },
    {
        id: 2,
        category: 'users',
        message: 'You have a new customer, Sarah Thompson.',
        timestamp: '24-Mar-2026 04:38 pm',
        read: false,
    },
    {
        id: 3,
        category: 'appointments',
        message: 'Customer, test has scheduled an appointment with Jason Miller for Whole School Tour @ 08 Apr 2026 09:15 am.',
        timestamp: '24-Mar-2026 04:37 pm',
        read: true,
    },
    {
        id: 4,
        category: 'users',
        message: 'You have a new customer, tst.',
        timestamp: '24-Mar-2026 04:37 pm',
        read: true,
    },
    {
        id: 5,
        category: 'appointments',
        message: 'Customer, test has scheduled an appointment with Jason Miller for Whole School Tour @ 09 Apr 2026 09:00 am.',
        timestamp: '24-Mar-2026 04:36 pm',
        read: true,
    },
    {
        id: 6,
        category: 'appointments',
        message: 'Customer, test has scheduled an appointment with Jason Miller for Whole School Tour @ 25 Mar 2026 09:00 am.',
        timestamp: '24-Mar-2026 04:33 pm',
        read: true,
    },
    {
        id: 7,
        category: 'appointments',
        message: 'Customer, Vinai Malhotra has scheduled an appointment with Jason Miller for SLT Assessment Test 2 @ 03 Apr 2026 09:00 am.',
        timestamp: '24-Mar-2026 04:30 pm',
        read: true,
    },
    {
        id: 8,
        category: 'payment',
        message: 'Payment of $150.00 received from Martha Johnson for Whole School Tour appointment.',
        timestamp: '24-Mar-2026 04:25 pm',
        read: true,
    },
    {
        id: 9,
        category: 'connections',
        message: 'Google Calendar has been successfully connected for Jason Miller.',
        timestamp: '24-Mar-2026 03:50 pm',
        read: true,
    },
    {
        id: 10,
        category: 'event_types',
        message: 'A new service "Advanced Consultation" has been created by Jason Miller.',
        timestamp: '24-Mar-2026 03:45 pm',
        read: true,
    },
    {
        id: 11,
        category: 'appointments',
        message: 'Customer, David Lee has rescheduled an appointment with Jason Miller for SLT Assessment Test @ 10 Apr 2026 02:00 pm.',
        timestamp: '24-Mar-2026 03:15 pm',
        read: true,
    },
    {
        id: 12,
        category: 'users',
        message: 'You have a new customer, Emily Roberts.',
        timestamp: '24-Mar-2026 02:50 pm',
        read: true,
    },
];

const getCategoryIcon = (category) => {
    switch (category) {
        case 'appointments':
            return (
                <div className="notif-icon notif-icon-appointments">
                    <Calendar size={16} />
                </div>
            );
        case 'users':
            return (
                <div className="notif-icon notif-icon-users">
                    <User size={16} />
                </div>
            );
        case 'payment':
            return (
                <div className="notif-icon notif-icon-payment">
                    <CreditCard size={16} />
                </div>
            );
        case 'connections':
            return (
                <div className="notif-icon notif-icon-connections">
                    <Link2 size={16} />
                </div>
            );
        case 'event_types':
            return (
                <div className="notif-icon notif-icon-events">
                    <Grid size={16} />
                </div>
            );
        default:
            return (
                <div className="notif-icon notif-icon-default">
                    <Calendar size={16} />
                </div>
            );
    }
};

const NotificationPanel = ({ isOpen, onClose }) => {
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);
    const panelRef = useRef(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Close panel on Escape key
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    const filteredNotifications = selectedCategory === 'all'
        ? SAMPLE_NOTIFICATIONS
        : SAMPLE_NOTIFICATIONS.filter(n => n.category === selectedCategory);

    const currentCategoryLabel = CATEGORIES.find(c => c.key === selectedCategory)?.label || 'All';

    const unreadCount = SAMPLE_NOTIFICATIONS.filter(n => !n.read).length;

    return (
        <>
            {/* Overlay */}
            <div
                className={`notif-overlay ${isOpen ? 'notif-overlay-visible' : ''}`}
                onClick={onClose}
            />

            {/* Panel */}
            <div
                ref={panelRef}
                className={`notif-panel ${isOpen ? 'notif-panel-open' : ''}`}
            >
                {/* Header */}
                <div className="notif-panel-header">
                    <div className="notif-panel-header-left">
                        <h2 className="notif-panel-title">Notifications</h2>
                        {unreadCount > 0 && (
                            <span className="notif-unread-badge">{unreadCount}</span>
                        )}
                    </div>
                    <div className="notif-panel-header-right">
                        {/* Category Dropdown */}
                        <div className="notif-dropdown-container" ref={dropdownRef}>
                            <button
                                className="notif-dropdown-trigger"
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            >
                                <span>{currentCategoryLabel}</span>
                                <ChevronDown
                                    size={14}
                                    className={`notif-dropdown-chevron ${isDropdownOpen ? 'notif-dropdown-chevron-open' : ''}`}
                                />
                            </button>

                            {isDropdownOpen && (
                                <div className="notif-dropdown-menu">
                                    {CATEGORIES.map(cat => (
                                        <button
                                            key={cat.key}
                                            className={`notif-dropdown-item ${selectedCategory === cat.key ? 'notif-dropdown-item-active' : ''}`}
                                            onClick={() => {
                                                setSelectedCategory(cat.key);
                                                setIsDropdownOpen(false);
                                            }}
                                        >
                                            {cat.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button className="notif-settings-btn" title="Notification Settings">
                            <Settings size={18} />
                        </button>

                        <button className="notif-close-btn" onClick={onClose} title="Close">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Notification List */}
                <div className="notif-panel-body">
                    {filteredNotifications.length === 0 ? (
                        <div className="notif-empty">
                            <div className="notif-empty-icon">
                                <Calendar size={32} />
                            </div>
                            <p className="notif-empty-text">No notifications in this category</p>
                        </div>
                    ) : (
                        <div className="notif-list">
                            {filteredNotifications.map(notification => (
                                <div
                                    key={notification.id}
                                    className={`notif-item ${!notification.read ? 'notif-item-unread' : ''}`}
                                >
                                    {getCategoryIcon(notification.category)}
                                    <div className="notif-item-content">
                                        <p className="notif-item-message">{notification.message}</p>
                                        <div className="notif-item-time">
                                            <Calendar size={12} />
                                            <span>{notification.timestamp}</span>
                                        </div>
                                    </div>
                                    {!notification.read && <div className="notif-item-dot" />}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="notif-panel-footer">
                    <button className="notif-mark-all-btn">Mark all as read</button>
                </div>
            </div>
        </>
    );
};

export default NotificationPanel;
