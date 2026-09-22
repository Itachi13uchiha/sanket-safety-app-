/**
 * Schema is applied idempotently at boot. `PRAGMA user_version` tracks the applied migration so future
 * changes can be appended to MIGRATIONS without touching earlier ones.
 */
export const MIGRATIONS: string[] = [
  /* 1 ─ initial schema */ `
  CREATE TABLE reporters (
    id              TEXT PRIMARY KEY,               -- HMAC of the device key; the key itself is never stored
    created_at      INTEGER NOT NULL,
    behavior        REAL NOT NULL DEFAULT 1.0,      -- multiplier moved by moderation outcomes and anti-abuse checks
    confirmed_count INTEGER NOT NULL DEFAULT 0,
    rejected_count  INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE areas (
    id        TEXT PRIMARY KEY,
    name      TEXT NOT NULL,
    city      TEXT NOT NULL,
    lat       REAL NOT NULL,
    lng       REAL NOT NULL,
    radius_m  INTEGER NOT NULL DEFAULT 500,
    active    INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE patterns (
    id                 TEXT PRIMARY KEY,
    category           TEXT NOT NULL,
    status             TEXT NOT NULL CHECK (status IN ('monitoring','emerging','escalated','resolved')),
    lat                REAL NOT NULL,
    lng                REAL NOT NULL,
    area_id            TEXT REFERENCES areas(id) ON DELETE SET NULL,
    area_label         TEXT NOT NULL,
    report_count       INTEGER NOT NULL DEFAULT 0,
    distinct_reporters INTEGER NOT NULL DEFAULT 0,
    effective_reporters REAL NOT NULL DEFAULT 0,
    distinct_periods   INTEGER NOT NULL DEFAULT 0,
    distinct_days      INTEGER NOT NULL DEFAULT 0,
    spread_m           REAL NOT NULL DEFAULT 0,
    confidence         INTEGER NOT NULL DEFAULT 0,
    peak_start_hour    INTEGER,
    peak_end_hour      INTEGER,
    analysis_json      TEXT NOT NULL DEFAULT '{}',
    first_seen_at      INTEGER NOT NULL,
    last_report_at     INTEGER NOT NULL,
    emerged_at         INTEGER,                     -- set once the pattern first met the "emerging" bar
    resolved_at        INTEGER,
    merged_into        TEXT,
    created_at         INTEGER NOT NULL,
    updated_at         INTEGER NOT NULL
  );
  CREATE INDEX idx_patterns_status   ON patterns(status, merged_into);
  CREATE INDEX idx_patterns_geo      ON patterns(category, lat, lng);

  CREATE TABLE pattern_events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern_id TEXT NOT NULL REFERENCES patterns(id) ON DELETE CASCADE,
    ts         INTEGER NOT NULL,
    type       TEXT NOT NULL,
    actor      TEXT,
    detail     TEXT
  );
  CREATE INDEX idx_pattern_events ON pattern_events(pattern_id, ts);
  CREATE INDEX idx_pattern_events_ts ON pattern_events(ts);

  CREATE TABLE reports (
    id              TEXT PRIMARY KEY,
    reporter_id     TEXT NOT NULL REFERENCES reporters(id) ON DELETE CASCADE,
    category        TEXT NOT NULL,
    lat             REAL NOT NULL,
    lng             REAL NOT NULL,
    location_source TEXT NOT NULL DEFAULT 'current',
    area_id         TEXT REFERENCES areas(id) ON DELETE SET NULL,
    area_label      TEXT NOT NULL,
    time_bucket     TEXT NOT NULL,
    occurred_at     INTEGER NOT NULL,
    created_at      INTEGER NOT NULL,
    note            TEXT,
    note_hash       TEXT,
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','confirmed','dismissed','spam')),
    suspicious      INTEGER NOT NULL DEFAULT 0,
    pattern_id      TEXT REFERENCES patterns(id) ON DELETE SET NULL,
    review_note     TEXT,
    reviewed_by     TEXT,
    reviewed_at     INTEGER,
    idem_key        TEXT
  );
  CREATE INDEX idx_reports_cat_time  ON reports(category, occurred_at);
  CREATE INDEX idx_reports_geo       ON reports(lat, lng);
  CREATE INDEX idx_reports_reporter  ON reports(reporter_id, created_at);
  CREATE INDEX idx_reports_pattern   ON reports(pattern_id);
  CREATE INDEX idx_reports_created   ON reports(created_at);
  CREATE UNIQUE INDEX idx_reports_idem ON reports(reporter_id, idem_key) WHERE idem_key IS NOT NULL;

  CREATE TABLE alerts (
    id                 TEXT PRIMARY KEY,
    pattern_id         TEXT NOT NULL UNIQUE REFERENCES patterns(id) ON DELETE CASCADE,
    level              TEXT NOT NULL CHECK (level IN ('low','medium','high')),
    status             TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','escalated','resolved')),
    title              TEXT NOT NULL,
    body               TEXT NOT NULL,
    recommended_action TEXT NOT NULL,
    created_at         INTEGER NOT NULL,
    updated_at         INTEGER NOT NULL,
    handled_by         TEXT
  );
  CREATE INDEX idx_alerts_status ON alerts(status, created_at);

  CREATE TABLE users (
    id              TEXT PRIMARY KEY,
    official_id     TEXT NOT NULL UNIQUE,
    email           TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    password_hash   TEXT NOT NULL,
    role            TEXT NOT NULL CHECK (role IN ('officer','supervisor','admin')),
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until    INTEGER,
    last_login_at   INTEGER,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
  );

  CREATE TABLE sessions (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    revoked_at INTEGER
  );
  CREATE INDEX idx_sessions_user ON sessions(user_id);

  CREATE TABLE otp_challenges (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash    TEXT NOT NULL,
    expires_at   INTEGER NOT NULL,
    attempts     INTEGER NOT NULL DEFAULT 0,
    resends      INTEGER NOT NULL DEFAULT 0,
    last_sent_at INTEGER NOT NULL,
    consumed_at  INTEGER,
    created_at   INTEGER NOT NULL
  );

  CREATE TABLE password_resets (
    token_hash  TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at  INTEGER NOT NULL,
    consumed_at INTEGER
  );

  CREATE TABLE cases (
    id                  TEXT PRIMARY KEY,
    seq                 INTEGER NOT NULL UNIQUE,
    pattern_id          TEXT REFERENCES patterns(id) ON DELETE SET NULL,
    title               TEXT NOT NULL,
    category            TEXT NOT NULL,
    area_label          TEXT NOT NULL,
    lat                 REAL,
    lng                 REAL,
    status              TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','on_hold','closed')),
    priority            TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
    assigned_officer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_by          TEXT NOT NULL,
    created_at          INTEGER NOT NULL,
    updated_at          INTEGER NOT NULL,
    closed_at           INTEGER
  );
  CREATE INDEX idx_cases_status ON cases(status);
  CREATE INDEX idx_cases_officer ON cases(assigned_officer_id);

  CREATE TABLE case_reports (
    case_id   TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    added_at  INTEGER NOT NULL,
    PRIMARY KEY (case_id, report_id)
  );

  CREATE TABLE case_notes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id    TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    author_id  TEXT NOT NULL,
    author     TEXT NOT NULL,
    body       TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE case_events (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id  TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    ts       INTEGER NOT NULL,
    type     TEXT NOT NULL,          -- created | status | assigned | note | report_linked | attachment
    actor    TEXT NOT NULL,
    from_val TEXT,
    to_val   TEXT,
    note     TEXT
  );

  CREATE TABLE case_attachments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id     TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    filename    TEXT NOT NULL,
    mime_type   TEXT NOT NULL,
    size_bytes  INTEGER NOT NULL,
    sha256      TEXT NOT NULL,
    storage_key TEXT,
    uploaded_by TEXT NOT NULL,
    created_at  INTEGER NOT NULL
  );

  CREATE TABLE audit_logs (
    seq        INTEGER PRIMARY KEY AUTOINCREMENT,
    ts         INTEGER NOT NULL,
    actor_id   TEXT,
    actor      TEXT NOT NULL,
    action     TEXT NOT NULL,
    resource   TEXT,
    ip         TEXT,
    device     TEXT,
    result     TEXT NOT NULL CHECK (result IN ('success','failed','denied')),
    meta       TEXT,
    prev_hash  TEXT NOT NULL,
    hash       TEXT NOT NULL
  );
  CREATE INDEX idx_audit_ts ON audit_logs(ts);
  CREATE INDEX idx_audit_action ON audit_logs(action);

  CREATE TABLE notifications (
    id         TEXT PRIMARY KEY,
    audience   TEXT NOT NULL CHECK (audience IN ('citizen','authority','system')),
    type       TEXT NOT NULL,
    title      TEXT NOT NULL,
    body       TEXT NOT NULL,
    level      TEXT,
    pattern_id TEXT,
    lat        REAL,
    lng        REAL,
    user_id    TEXT,                    -- set for notifications addressed to one officer
    created_at INTEGER NOT NULL
  );
  CREATE INDEX idx_notifications_aud ON notifications(audience, created_at);

  CREATE TABLE notification_reads (
    notification_id TEXT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at         INTEGER NOT NULL,
    PRIMARY KEY (notification_id, user_id)
  );

  CREATE TABLE settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  `,
];
