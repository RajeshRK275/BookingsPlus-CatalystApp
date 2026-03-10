const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(403).json({ success: false, message: 'Role missing from context.' });
        }
        
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ success: false, message: 'Insufficient permissions.' });
        }
        
        next();
    }
}

module.exports = requireRole;
