CREATE TABLE IF NOT EXISTS scores (
  run_id TEXT PRIMARY KEY,
  d TEXT NOT NULL,
  p INTEGER,
  b INTEGER,
  s INTEGER NOT NULL DEFAULT 0,
  l INTEGER,
  x INTEGER,
  tl INTEGER,
  ms INTEGER,
  i TEXT NOT NULL,
  w INTEGER NOT NULL DEFAULT 0,
  m TEXT NOT NULL,
  pid TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scores_daily_date
  ON scores(m, d, b, ms, s, tl);

CREATE INDEX IF NOT EXISTS idx_scores_daily_player
  ON scores(m, i, b, ms, s, tl);

CREATE INDEX IF NOT EXISTS idx_scores_endless_player
  ON scores(m, i, s, ms);

-- Weekly, Hall of Fame and Unlimited dedupe on UPPER(i) — initials are the
-- player identity. pid is still written on save but no longer ranks anything;
-- it is kept for auditing and can be dropped once nothing reads it.
CREATE INDEX IF NOT EXISTS idx_scores_pid
  ON scores(m, pid, b, ms, s, tl);
