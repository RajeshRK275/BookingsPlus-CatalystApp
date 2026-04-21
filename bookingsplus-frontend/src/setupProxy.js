const { createProxyMiddleware } = require('http-proxy-middleware');

// catalyst serve runs the full Catalyst stack (functions + client) on port 5000.
// The React dev server (port 3000) needs to proxy Catalyst-specific paths there
// so that /__catalyst/sdk/init.js, auth routes, and backend APIs resolve correctly.
const CATALYST_SERVE_URL = 'http://localhost:5000';

module.exports = function (app) {
    // Proxy ALL /__catalyst/* routes — includes sdk/init.js, auth login/logout etc.
    app.use(
        '/__catalyst',
        createProxyMiddleware({
            target: CATALYST_SERVE_URL,
            changeOrigin: true,
        })
    );

    // Proxy backend Advanced I/O function calls
    app.use(
        '/server',
        createProxyMiddleware({
            target: CATALYST_SERVE_URL,
            changeOrigin: true,
        })
    );

    // Proxy Catalyst's built-in /baas routes (data store, file store, etc.)
    app.use(
        '/baas',
        createProxyMiddleware({
            target: CATALYST_SERVE_URL,
            changeOrigin: true,
        })
    );
};
