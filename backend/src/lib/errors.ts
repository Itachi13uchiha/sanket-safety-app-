export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
    public readonly headers?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const Errors = {
  badRequest: (message: string, code = 'BAD_REQUEST', details?: unknown) =>
    new ApiError(400, code, message, details),
  validation: (details: unknown) =>
    new ApiError(422, 'VALIDATION_ERROR', 'Request validation failed', details),
  unauthorized: (message = 'Authentication required', code = 'UNAUTHORIZED') =>
    new ApiError(401, code, message),
  forbidden: (message = 'You do not have permission to perform this action', code = 'FORBIDDEN') =>
    new ApiError(403, code, message),
  notFound: (what = 'Resource') => new ApiError(404, 'NOT_FOUND', `${what} not found`),
  conflict: (message: string, code = 'CONFLICT', details?: unknown) =>
    new ApiError(409, code, message, details),
  locked: (message: string, retryAfterSeconds: number) =>
    new ApiError(423, 'ACCOUNT_LOCKED', message, { retryAfterSeconds }, {
      'Retry-After': String(retryAfterSeconds),
    }),
  rateLimited: (retryAfterSeconds: number, message = 'Too many requests. Please try again later.') =>
    new ApiError(429, 'RATE_LIMITED', message, { retryAfterSeconds }, {
      'Retry-After': String(retryAfterSeconds),
    }),
};
