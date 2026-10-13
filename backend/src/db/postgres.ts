import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { config } from '../config.js';

/**
 * Neon connection pool for the upcoming SQLite-to-PostgreSQL runtime conversion.
 * This module is intentionally not wired into the app yet: route/domain calls
 * still use synchronous better-sqlite3 and must be converted before cutover.
 */
if (config.isProd && !config.DATABASE_URL) {
  console.warn('DATABASE_URL is not configured; the legacy SQLite runtime is still active.');
}

export const pgPool = config.DATABASE_URL
  ? new Pool({
      connectionString: config.DATABASE_URL,
      // Neon requires TLS. Keep certificate verification enabled.
      ssl: { rejectUnauthorized: true },
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    })
  : null;

export async function pgQuery<Row extends QueryResultRow = QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
): Promise<QueryResult<Row>> {
  if (!pgPool) throw new Error('DATABASE_URL is required for PostgreSQL queries');
  return pgPool.query<Row>(text, [...values]);
}

/** Run PostgreSQL statements on one client with a real transaction. */
export async function pgTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  if (!pgPool) throw new Error('DATABASE_URL is required for PostgreSQL transactions');
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closePgPool(): Promise<void> {
  await pgPool?.end();
}
