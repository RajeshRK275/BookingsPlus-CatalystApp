/**
 * Standardized API Response Helpers
 * Ensures consistent response shape across all endpoints.
 */

const success = (res, data = null, message = 'Success', statusCode = 200, meta = {}) => {
    const body = { success: true, message };
    if (data !== null && data !== undefined) {
        if (Array.isArray(data)) {
            body.count = data.length;
            body.data = data;
        } else {
            body.data = data;
        }
    }
    if (Object.keys(meta).length > 0) {
        body.meta = meta;
    }
    return res.status(statusCode).json(body);
};

const created = (res, data, message = 'Created successfully') => {
    return success(res, data, message, 201);
};

const error = (res, message = 'An error occurred', statusCode = 500, code = 'INTERNAL_ERROR', details = null) => {
    const body = { success: false, message, code };
    if (details) body.details = details;
    return res.status(statusCode).json(body);
};

const paginated = (res, data, page, pageSize, totalCount) => {
    return res.status(200).json({
        success: true,
        data,
        pagination: {
            page,
            pageSize,
            totalCount,
            totalPages: Math.ceil(totalCount / pageSize),
            hasMore: page * pageSize < totalCount,
        },
    });
};

module.exports = { success, created, error, paginated };
