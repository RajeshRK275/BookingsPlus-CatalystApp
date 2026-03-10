// Environment configuration mapping
require('dotenv').config();

module.exports = {
    jwtSecret: process.env.JWT_SECRET || 'fallback-secret-for-dev',
    tokenExpiry: process.env.TOKEN_EXPIRY || '24h',
    environment: process.env.NODE_ENV || 'development'
};
