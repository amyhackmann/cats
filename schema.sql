CREATE TABLE IF NOT EXISTS scores (
  run_id TEXT PRIMARY KEY,
  d TEXT NOT NULL,
  p INTEGER,
  b INTEGER,
  s INTEGER NOT NULL DEFAULT 0,
  l INTEGER,
  x INTEGER,
  ms INTEGER,
  i TEXT NOT NULL,
  w INTEGER NOT NULL DEFAULT 0,
  m TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scores_daily_date
  ON scores(m, d, b, ms, s);

CREATE INDEX IF NOT EXISTS idx_scores_daily_player
  ON scores(m, i, b, ms, s);

CREATE INDEX IF NOT EXISTS idx_scores_endless_player
  ON scores(m, i, s, ms);
