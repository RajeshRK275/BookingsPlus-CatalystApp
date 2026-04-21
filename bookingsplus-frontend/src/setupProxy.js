const { createProxyMiddleware } = require('http-proxy-middleware');

// Dev server runs on port 5000 (either catalyst serve or our standalone dev-server.js).
// Using 127.0.0.1 explicitly to avoid IPv4/IPv6 resolution issues with "localhost".
const BACKEND_URL = 'http://127.0.0.1:5000';

module.exports = function (app) {
    // Proxy backend API calls
    app.use(
        '/server',
        createProxyMiddleware({
            target: BACKEND_URL,
            changeOrigin: true,
        })
    );
};
