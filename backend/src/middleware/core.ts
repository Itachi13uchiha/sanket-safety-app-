import crypto from 'node:crypto';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { ApiError, Errors } from '../lib/errors.js';
import { log } from '../lib/logger.js';

export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.header('x-request-id');
  req.requestId = incoming && /^[\w-]{8,64}$/.test(incoming) ? incoming : crypto.randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  res.setHeader('Cache-Control', 'no-store');
  next();
};

/** Access log. Deliberately excludes IPs, query strings (which may carry coordinates) and bodies. */
export const accessLog: RequestHandler = (req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    log.info('http', {
      id: req.requestId,
      method: req.method,
      path: req.baseUrl + req.path,
      status: res.statusCode,
      ms: Math.round(Number(process.hrtime.bigint() - start) / 1e6),
    });
  });
  next();
};

const limiter = (windowMs: number, limit: number, message: string) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => config.isTest,
    handler: (_req, _res, next) => next(Errors.rateLimited(Math.ceil(windowMs / 1000), message)),
  });

export const globalLimiter = limiter(60_000, 300, 'Too many requests. Please slow down.');
export const sessionLimiter = limiter(60 * 60_000, 20, 'Too many new sessions from this network. Please try again later.');
export const reportLimiter = limiter(60 * 60_000, 40, 'Too many reports from this network. Please try again later.');
export const loginLimiter = limiter(15 * 60_000, 15, 'Too many sign-in attempts. Please try again later.');
export const otpLimiter = limiter(15 * 60_000, 30, 'Too many verification attempts. Please try again later.');

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new ApiError(404, 'NOT_FOUND', `No route for ${req.method} ${req.path}`));
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = req.requestId;
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Something went wrong on our side. Please try again.';
  let details: unknown;

  if (err instanceof ApiError) {
    status = err.status;
    code = err.code;
    message = err.message;
    details = err.details;
    for (const [k, v] of Object.entries(err.headers ?? {})) res.setHeader(k, v);
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'Request body is not valid JSON';
  } else if (err?.type === 'entity.too.large') {
    status = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Request body is too large';
  } else {
    log.error('unhandled', { id: requestId, err: err?.message, stack: config.isProd ? undefined : err?.stack });
  }

  if (res.headersSent) return;
  res.status(status).json({ error: { code, message, ...(details !== undefined ? { details } : {}), requestId } });
};
