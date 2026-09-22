import { config } from '../config.js';

type Level = 'debug' | 'info' | 'warn' | 'error';
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN: number = config.isTest ? 100 : config.isProd ? ORDER.info : ORDER.debug;

function emit(level: Level, msg: string, fields?: Record<string, unknown>) {
  if (ORDER[level] < MIN) return;
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...fields });
  (level === 'error' || level === 'warn' ? console.error : console.log)(line);
}

/** Structured logger. Never pass IP addresses or report contents into these calls. */
export const log = {
  debug: (msg: string, f?: Record<string, unknown>) => emit('debug', msg, f),
  info: (msg: string, f?: Record<string, unknown>) => emit('info', msg, f),
  warn: (msg: string, f?: Record<string, unknown>) => emit('warn', msg, f),
  error: (msg: string, f?: Record<string, unknown>) => emit('error', msg, f),
};
