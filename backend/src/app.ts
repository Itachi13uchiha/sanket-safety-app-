import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { db } from './db/index.js';
import { accessLog, errorHandler, globalLimiter, notFoundHandler, requestId } from './middleware/core.js';
import { authRouter } from './routes/auth.js';
import { authorityRouter } from './routes/authority/index.js';
import { publicRouter } from './routes/public.js';
import { reportsRouter } from './routes/reports.js';
import './types.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.TRUST_PROXY);

  app.use(requestId);
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || config.corsOrigins.includes(origin)),
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'Accept-Language', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id', 'Retry-After'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '32kb' }));
  app.use(accessLog);
  app.use(globalLimiter);

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/ready', (_req, res) => {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ready' });
  });

  app.use('/v1', publicRouter);
  app.use('/v1', reportsRouter);
  app.use('/v1', authRouter);
  app.use('/v1/authority', authorityRouter);

  // If the frontend has been built (npm run build in ../frontend), serve it from the same origin.
  const dist = path.resolve(config.FRONTEND_DIST);
  if (fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.get(/^\/(?!v1\/|health$|ready$).*/, (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(dist, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
