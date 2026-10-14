import { closePgPool, pgQuery } from '../src/db/postgres.js';

const required: Record<string, string[]> = {
  reporters: ['id', 'created_at', 'behavior', 'confirmed_count', 'rejected_count'],
  areas: ['id', 'name', 'city', 'lat', 'lng', 'radius_m', 'active'],
  patterns: [
    'id', 'category', 'status', 'lat', 'lng', 'area_id', 'area_label', 'report_count',
    'distinct_reporters', 'effective_reporters', 'distinct_periods', 'distinct_days',
    'spread_m', 'confidence', 'peak_start_hour', 'peak_end_hour', 'analysis_json',
    'first_seen_at', 'last_report_at', 'emerged_at', 'resolved_at', 'merged_into',
    'created_at', 'updated_at',
  ],
  pattern_events: ['id', 'pattern_id', 'ts', 'type', 'actor', 'detail'],
  reports: [
    'id', 'reporter_id', 'category', 'lat', 'lng', 'location_source', 'area_id', 'area_label',
    'time_bucket', 'occurred_at', 'created_at', 'note', 'note_hash', 'status', 'suspicious',
    'pattern_id', 'review_note', 'reviewed_by', 'reviewed_at', 'idem_key',
  ],
  alerts: ['id', 'pattern_id', 'level', 'status', 'title', 'body', 'recommended_action', 'created_at', 'updated_at', 'handled_by'],
  users: [
    'id', 'official_id', 'email', 'name', 'password_hash', 'role', 'status', 'failed_attempts',
    'locked_until', 'last_login_at', 'created_at', 'updated_at',
  ],
  sessions: ['id', 'user_id', 'created_at', 'expires_at', 'revoked_at'],
  otp_challenges: ['id', 'user_id', 'code_hash', 'expires_at', 'attempts', 'resends', 'last_sent_at', 'consumed_at', 'created_at'],
  password_resets: ['token_hash', 'user_id', 'expires_at', 'consumed_at'],
  cases: [
    'id', 'seq', 'pattern_id', 'title', 'category', 'area_label', 'lat', 'lng', 'status',
    'priority', 'assigned_officer_id', 'created_by', 'created_at', 'updated_at', 'closed_at',
  ],
  case_reports: ['case_id', 'report_id', 'added_at'],
  case_notes: ['id', 'case_id', 'author_id', 'author', 'body', 'created_at'],
  case_events: ['id', 'case_id', 'ts', 'type', 'actor', 'from_val', 'to_val', 'note'],
  case_attachments: ['id', 'case_id', 'filename', 'mime_type', 'size_bytes', 'sha256', 'storage_key', 'uploaded_by', 'created_at'],
  audit_logs: [
    'seq', 'ts', 'actor_id', 'actor', 'action', 'resource', 'ip', 'device', 'result', 'meta', 'prev_hash', 'hash',
  ],
  notifications: ['id', 'audience', 'type', 'title', 'body', 'level', 'pattern_id', 'lat', 'lng', 'user_id', 'created_at'],
  notification_reads: ['notification_id', 'user_id', 'read_at'],
  settings: ['key', 'value', 'updated_at'],
};

async function main() {
  const names = Object.keys(required);
  const result = await pgQuery<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = ANY($1::text[])`,
    [names],
  );

  const actual = new Map<string, Set<string>>();
  for (const row of result.rows) {
    const columns = actual.get(row.table_name) ?? new Set<string>();
    columns.add(row.column_name);
    actual.set(row.table_name, columns);
  }

  const missing: string[] = [];
  for (const [table, columns] of Object.entries(required)) {
    const found = actual.get(table);
    if (!found) {
      missing.push(`${table} (table missing)`);
      continue;
    }
    for (const column of columns) {
      if (!found.has(column)) missing.push(`${table}.${column}`);
    }
  }

  if (missing.length) {
    console.error('Neon schema preflight FAILED. Missing required tables/columns:');
    for (const item of missing) console.error(`  - ${item}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Neon schema preflight passed: ${names.length} tables and all required columns are present.`);
  console.log('This check is read-only; it does not create, alter, or migrate any data.');
}

try {
  await main();
} catch (error) {
  console.error('Neon schema preflight FAILED:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await closePgPool();
}
