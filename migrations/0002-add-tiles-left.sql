-- Tiles the deck still owed the player, counted in cells rather than pieces.
-- Additive only: no row is rewritten or deleted. Existing rows get tl = NULL,
-- and SQLite sorts NULL last under DESC, so every score saved before this
-- migration keeps its place and simply loses the final tiebreaker.
ALTER TABLE scores ADD COLUMN tl INTEGER;

DROP INDEX IF EXISTS idx_scores_daily_date;
DROP INDEX IF EXISTS idx_scores_daily_player;
DROP INDEX IF EXISTS idx_scores_pid;

CREATE INDEX IF NOT EXISTS idx_scores_daily_date
  ON scores(m, d, b, ms, s, tl);

CREATE INDEX IF NOT EXISTS idx_scores_daily_player
  ON scores(m, i, b, ms, s, tl);

CREATE INDEX IF NOT EXISTS idx_scores_pid
  ON scores(m, pid, b, ms, s, tl);
