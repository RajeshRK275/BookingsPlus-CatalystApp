/**
 * Utility Formatters — Used across all pages and components.
 */

/** Get 2-letter initials from a name */
export const getInitials = (name) =>
    name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '??';

/** Format minutes to human-readable duration */
export const formatDuration = (mins) => {
    if (!mins) return '-';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h && m) return `${h} Hour${h > 1 ? 's' : ''} ${m} mins`;
    if (h) return `${h} Hour${h > 1 ? 's' : ''}`;
    return `${m} mins`;
};

/** Format service type slug to display label */
export const formatServiceType = (type) => {
    if (!type) return 'One-on-One';
    const map = {
        'one-on-one': 'One-on-One',
        'group': 'Group Booking',
        'collective': 'Collective Booking',
        'resource': 'Resource',
    };
    return map[type] || type;
};

/** Format ISO time to HH:mm am/pm */
export const formatTime = (isoString) => {
    if (!isoString) return '-';
    const d = new Date(isoString);
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'pm' : 'am';
    const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${hour.toString().padStart(2, '0')}:${m} ${ampm}`;
};

/** Format time range */
export const formatTimeRange = (start, end) => `${formatTime(start)} - ${formatTime(end)}`;

/** Format date header for appointment groups */
export const formatDateHeader = (isoString) => {
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const d = new Date(isoString);
    return `${d.getDate().toString().padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};
