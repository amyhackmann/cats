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

-- Dedupe key for Weekly, Hall of Fame and Unlimited: the device's player id,
-- falling back to initials for rows saved before pid existed.
CREATE INDEX IF NOT EXISTS idx_scores_pid
  ON scores(m, pid, b, ms, s, tl);
