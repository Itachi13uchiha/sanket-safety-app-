import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from '../config.js';
import { MIGRATIONS } from './schema.js';

function open(): Database.Database {
  // Vercel's deployment filesystem is read-only. Relative SQLite paths must use
  // /tmp there; local development keeps the configured path unchanged.
  const databasePath = process.env.VERCEL === '1' && !path.isAbsolute(config.DATABASE_PATH)
    ? path.join('/tmp', config.DATABASE_PATH)
    : config.DATABASE_PATH;

  if (databasePath !== ':memory:') {
    fs.mkdirSync(path.dirname(path.resolve(databasePath)), { recursive: true });
  }
  const conn = new Database(databasePath);
  conn.pragma('journal_mode = WAL');
  conn.pragma('synchronous = NORMAL');
  conn.pragma('foreign_keys = ON');
  conn.pragma('busy_timeout = 5000');

  const current = conn.pragma('user_version', { simple: true }) as number;
  for (let v = current; v < MIGRATIONS.length; v++) {
    conn.transaction(() => {
      conn.exec(MIGRATIONS[v]!);
      conn.pragma(`user_version = ${v + 1}`);
    })();
  }
  return conn;
}

export const db = open();

/** Run `fn` atomically. Uses BEGIN IMMEDIATE so concurrent processes serialise on the write lock. */
export function tx<T>(fn: () => T): T {
  return db.transaction(fn).immediate();
}

export function closeDb() {
  db.close();
}
