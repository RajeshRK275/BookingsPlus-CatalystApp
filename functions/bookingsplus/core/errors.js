/**
 * Custom Application Error Classes
 * Provides structured error handling across all route handlers and services.
 */

class AppError extends Error {
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

class NotFoundError extends AppError {
    constructor(resource = 'Resource', id = '') {
        super(`${resource}${id ? ` (${id})` : ''} not found.`, 404, 'NOT_FOUND');
    }
}

class ValidationError extends AppError {
    constructor(message = 'Validation failed.', details = null) {
        super(message, 400, 'VALIDATION_ERROR');
        this.details = details;
    }
}

class AuthenticationError extends AppError {
    constructor(message = 'Authentication required.') {
        super(message, 401, 'AUTH_REQUIRED');
    }
}

class ForbiddenError extends AppError {
    constructor(message = 'You do not have permission to perform this action.') {
        super(message, 403, 'FORBIDDEN');
    }
}

class ConflictError extends AppError {
    constructor(message = 'Resource already exists.') {
        super(message, 409, 'CONFLICT');
    }
}

class ExternalServiceError extends AppError {
    constructor(service = 'External Service', originalError = null) {
        super(`${service} failed: ${originalError?.message || 'Unknown error'}`, 502, 'EXTERNAL_SERVICE_ERROR');
        this.originalError = originalError;
    }
}

module.exports = {
    AppError,
    NotFoundError,
    ValidationError,
    AuthenticationError,
    ForbiddenError,
    ConflictError,
    ExternalServiceError,
};
