// Migration tuần tự; mỗi phần tử chạy đúng một lần (ghi vào schema_migrations).
export const MIGRATIONS = [
  {
    version: 1,
    name: "init",
    sql: `
CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  plan          TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','plus','studio')),
  locale        TEXT NOT NULL DEFAULT 'vi' CHECK (locale IN ('vi','en')),
  onboarding    TEXT,
  email_verified_at TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at    TEXT
);
CREATE INDEX idx_users_created ON users(created_at);
CREATE INDEX idx_users_role_plan ON users(role, plan);

CREATE TABLE refresh_tokens (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_refresh_user ON refresh_tokens(user_id);

CREATE TABLE email_tokens (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose    TEXT NOT NULL CHECK (purpose IN ('verify','reset')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at    TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE outbox (
  id         INTEGER PRIMARY KEY,
  to_email   TEXT NOT NULL,
  subject    TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE favorites (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id  TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, lesson_id)
);

CREATE TABLE practice_sessions (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id  TEXT NOT NULL,
  mode       TEXT NOT NULL CHECK (mode IN ('learn','wait','exam')),
  accuracy   REAL NOT NULL CHECK (accuracy BETWEEN 0 AND 1),
  duration_s INTEGER NOT NULL CHECK (duration_s BETWEEN 1 AND 7200),
  xp         INTEGER NOT NULL DEFAULT 0,
  day        TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_sessions_user_day ON practice_sessions(user_id, day);
CREATE INDEX idx_sessions_created ON practice_sessions(created_at);

CREATE TABLE user_badges (
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge     TEXT NOT NULL,
  earned_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, badge)
);

CREATE TABLE notifications (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  read_at    TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_notifications_user ON notifications(user_id, read_at);

CREATE TABLE events (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name       TEXT NOT NULL,
  props      TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_events_name_time ON events(name, created_at);

CREATE TABLE payments (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan       TEXT NOT NULL CHECK (plan IN ('plus','studio')),
  cycle      TEXT NOT NULL CHECK (cycle IN ('month','year')),
  amount_vnd INTEGER NOT NULL,
  provider   TEXT NOT NULL DEFAULT 'sandbox',
  status     TEXT NOT NULL CHECK (status IN ('paid','failed','refunded')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_payments_user ON payments(user_id);

CREATE TABLE contact_messages (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  topic      TEXT NOT NULL,
  message    TEXT NOT NULL,
  handled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
`,
  },
  {
    version: 2,
    name: "refresh_rotated_at",
    // Tách "bị thay do xoay vòng" (được ân hạn ngắn) khỏi "bị thu hồi" (đăng xuất, đổi mật khẩu, nghi đánh cắp).
    sql: "ALTER TABLE refresh_tokens ADD COLUMN rotated_at TEXT;",
  },
  {
    version: 3,
    name: "commerce",
    rebuild: true,
    sql: `
CREATE TABLE users_v3 (
  id            INTEGER PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  plan          TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','starter','plus','founder','studio')),
  locale        TEXT NOT NULL DEFAULT 'vi' CHECK (locale IN ('vi','en')),
  onboarding    TEXT,
  email_verified_at TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at    TEXT, plan_expires_at TEXT, b2b_partner_code TEXT, starter_instrument TEXT
);
INSERT INTO users_v3 SELECT *, NULL,NULL,NULL FROM users; DROP TABLE users; ALTER TABLE users_v3 RENAME TO users;
CREATE INDEX idx_users_created ON users(created_at);
CREATE INDEX idx_users_role_plan ON users(role, plan);

CREATE TABLE payments_v3 (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan       TEXT NOT NULL CHECK (plan IN ('starter','plus','founder','studio')),
  cycle      TEXT NOT NULL CHECK (cycle IN ('month','quarter','year')),
  amount_vnd INTEGER NOT NULL,
  provider   TEXT NOT NULL DEFAULT 'sandbox',
  status     TEXT NOT NULL CHECK (status IN ('pending','paid','failed','refunded')),
  order_code TEXT UNIQUE, provider_tx_id TEXT, qr_url TEXT, instrument TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

INSERT INTO payments_v3(id,user_id,plan,cycle,amount_vnd,provider,status,created_at) SELECT * FROM payments;
DROP TABLE payments; ALTER TABLE payments_v3 RENAME TO payments;
CREATE INDEX idx_payments_user ON payments(user_id);
CREATE UNIQUE INDEX idx_payment_tx ON payments(provider, provider_tx_id);
CREATE TABLE plan_periods(user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, plan TEXT NOT NULL, instrument TEXT, starts_at INTEGER NOT NULL, ends_at INTEGER NOT NULL, PRIMARY KEY(user_id,starts_at));
CREATE TABLE voucher_codes(id INTEGER PRIMARY KEY, digest TEXT UNIQUE NOT NULL, suffix TEXT NOT NULL, partner TEXT NOT NULL, plan TEXT NOT NULL, cycle TEXT NOT NULL, instrument TEXT, max_uses INTEGER NOT NULL, uses INTEGER NOT NULL DEFAULT 0, expires_at TEXT NOT NULL);
CREATE TABLE voucher_redemptions(voucher_id INTEGER REFERENCES voucher_codes(id), user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY(voucher_id,user_id));
CREATE TABLE weekly_goals(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, minutes INTEGER NOT NULL, days INTEGER NOT NULL);
CREATE TABLE b2b_studios(code TEXT PRIMARY KEY, name TEXT NOT NULL, owner_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE);
CREATE TABLE b2b_enrollments(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, studio_code TEXT NOT NULL REFERENCES b2b_studios(code) ON DELETE CASCADE, share INTEGER NOT NULL, since TEXT NOT NULL);
ALTER TABLE outbox ADD COLUMN transport TEXT NOT NULL DEFAULT 'outbox';
ALTER TABLE outbox ADD COLUMN sent_at TEXT;
ALTER TABLE outbox ADD COLUMN retry_at TEXT;
ALTER TABLE outbox ADD COLUMN mail_key TEXT;
CREATE UNIQUE INDEX idx_mail_key ON outbox(mail_key);
UPDATE outbox SET sent_at=created_at;
`,
  },
  {
    version: 4,
    name: "upgrade_m1_consents_mastery",
    sql: `
ALTER TABLE practice_sessions ADD COLUMN bar_errors_json TEXT;
ALTER TABLE practice_sessions ADD COLUMN error_codes_json TEXT;
ALTER TABLE practice_sessions ADD COLUMN input_source TEXT NOT NULL DEFAULT 'keyboard';

CREATE TABLE user_consents (
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('terms_privacy','parent_guardian','b2b_studio_share','local_mic_only')),
  granted      INTEGER NOT NULL DEFAULT 1,
  note         TEXT,
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, consent_type)
);

CREATE TABLE skill_mastery (
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_ref         TEXT NOT NULL,
  attempts          INTEGER NOT NULL DEFAULT 0,
  best_accuracy     REAL NOT NULL DEFAULT 0,
  last_practiced_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, skill_ref)
);
CREATE INDEX idx_skill_mastery_user ON skill_mastery(user_id, last_practiced_at);
`,
  },
  {
    version: 5,
    name: "wave2_import_community_rewards",
    sql: `
CREATE TABLE user_songs (
  id                INTEGER PRIMARY KEY,
  user_id           INTEGER REFERENCES users(id) ON DELETE CASCADE,
  code              TEXT NOT NULL UNIQUE,
  title             TEXT NOT NULL,
  artist            TEXT NOT NULL DEFAULT 'Bản chuyển tự động',
  theme             TEXT NOT NULL DEFAULT 'Tự chọn',
  genre             TEXT NOT NULL DEFAULT 'Acoustic / Ballad',
  bpm               INTEGER NOT NULL DEFAULT 72,
  tonic             TEXT NOT NULL DEFAULT 'C',
  mode              TEXT NOT NULL DEFAULT 'major',
  source_kind       TEXT NOT NULL DEFAULT 'audio_file',
  quality_note      TEXT NOT NULL DEFAULT 'Bản chuyển tự động — có thể chưa chính xác',
  arrangements_json TEXT NOT NULL,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_user_songs_user ON user_songs(user_id, created_at);

CREATE TABLE lesson_notes (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id  TEXT NOT NULL,
  bar_number INTEGER NOT NULL DEFAULT 1,
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_lesson_notes_user_lesson ON lesson_notes(user_id, lesson_id, bar_number);

CREATE TABLE community_posts (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  lesson_id   TEXT NOT NULL DEFAULT 'TS01',
  kind        TEXT NOT NULL DEFAULT 'comment' CHECK (kind IN ('comment','achievement','challenge')),
  content     TEXT NOT NULL,
  likes       INTEGER NOT NULL DEFAULT 0,
  hidden      INTEGER NOT NULL DEFAULT 0,
  reports     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_community_posts_created ON community_posts(created_at);

CREATE TABLE user_blocks (
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_user_id INTEGER NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, blocked_user_id)
);

CREATE TABLE reward_chests (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chest_key  TEXT NOT NULL,
  xp_awarded INTEGER NOT NULL DEFAULT 50,
  claimed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, chest_key)
);

CREATE TABLE game_scores (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  player     TEXT NOT NULL DEFAULT 'Học viên VocaVerse',
  game_id    TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  score      INTEGER NOT NULL,
  stars      INTEGER NOT NULL DEFAULT 1,
  xp         INTEGER NOT NULL DEFAULT 15,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_game_scores_game ON game_scores(game_id, score DESC);
`,
  },
];
