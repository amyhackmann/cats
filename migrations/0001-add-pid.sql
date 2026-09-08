-- Adds the true per-player key. Additive only: no row is rewritten or deleted,
-- so every existing Daily, Weekly, Hall of Fame and Unlimited score is preserved.
-- Old rows get pid = NULL and keep ranking under their initials until that player
-- saves a new run from a device, at which point their pid takes over.
ALTER TABLE scores ADD COLUMN pid TEXT;

CREATE INDEX IF NOT EXISTS idx_scores_pid
  ON scores(m, pid, b, ms, s);
