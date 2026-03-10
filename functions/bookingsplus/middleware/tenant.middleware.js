const tenantMiddleware = (req, res, next) => {
    if (!req.user || !req.user.tenant_id) {
        return res.status(403).json({ success: false, message: 'Tenant context is missing.' });
    }
    
    // Explicitly attach to request for easy access downstream
    req.tenantId = req.user.tenant_id;
    next();
};

module.exports = tenantMiddleware;
