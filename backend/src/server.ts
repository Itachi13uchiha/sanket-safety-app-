import { createApp } from './app.js';
import { config } from './config.js';
import { closeDb } from './db/index.js';
import { runMaintenance } from './domain/detection.js';
import { log } from './lib/logger.js';

const app = createApp();
const server = app.listen(config.PORT, () => {
  log.info('sanket.listening', { port: config.PORT, env: config.NODE_ENV });
});

let timer: NodeJS.Timeout | undefined;
if (config.JOBS_ENABLED) {
  const tick = () => {
    try {
      log.info('maintenance.done', runMaintenance());
    } catch (err) {
      log.error('maintenance.failed', { err: (err as Error).message });
    }
  };
  timer = setInterval(tick, 60 * 60 * 1000);
  timer.unref();
}

function shutdown(signal: string) {
  log.info('sanket.shutdown', { signal });
  if (timer) clearInterval(timer);
  server.close(() => {
    closeDb();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
