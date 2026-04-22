/**
 * Async Route Handler Wrapper
 * Eliminates try/catch boilerplate in every route handler.
 * Automatically passes errors to the Express error middleware.
 * 
 * Usage:
 *   router.get('/', asyncHandler(async (req, res) => {
 *       const data = await someService.getData();
 *       return response.success(res, data);
 *   }));
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
