const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const catalyst = require('zcatalyst-sdk-node');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Catalyst Initialization Middleware
app.use((req, res, next) => {
    // Initialize Catalyst App for every request
    req.catalystApp = catalyst.initialize(req);
    next();
});

// Import Routes
const authRoutes = require('./modules/auth/auth.routes');
const organizationsRoutes = require('./modules/organizations/organizations.routes');
const usersRoutes = require('./modules/users/users.routes');
const servicesRoutes = require('./modules/services/services.routes');
const appointmentsRoutes = require('./modules/appointments/appointments.routes');

// API V1 Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/organizations', organizationsRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/services', servicesRoutes);
app.use('/api/v1/appointments', appointmentsRoutes);

// Error Handling Middleware
app.use((err, req, res, next) => {
    console.error('Unhandled Server Error: ', err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error'
    });
});

module.exports = app;
