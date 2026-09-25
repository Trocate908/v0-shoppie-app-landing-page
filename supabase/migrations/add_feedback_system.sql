-- User feedback system: product suggestions with public voting, and IP capture
-- on content reports so anonymous spam can be rate limited.

-- Suggestions submitted by users ("I'd love it if ShoppieApp…")
CREATE TABLE IF NOT EXISTS suggestions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  author_name TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'feature',
  status TEXT NOT NULL DEFAULT 'submitted',
  admin_note TEXT,
  votes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Public board is filtered by status and ordered by votes
CREATE INDEX IF NOT EXISTS idx_suggestions_status ON suggestions(status);
CREATE INDEX IF NOT EXISTS idx_suggestions_votes ON suggestions(votes DESC);
CREATE INDEX IF NOT EXISTS idx_suggestions_user_id ON suggestions(user_id);

-- One vote per person per suggestion
CREATE TABLE IF NOT EXISTS suggestion_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  suggestion_id UUID NOT NULL REFERENCES suggestions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (suggestion_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_suggestion_votes_suggestion_id ON suggestion_votes(suggestion_id);
CREATE INDEX IF NOT EXISTS idx_suggestion_votes_user_id ON suggestion_votes(user_id);

-- Anonymous reports cannot be rate limited by user id, so keep the submitter IP
ALTER TABLE reports ADD COLUMN IF NOT EXISTS reporter_ip TEXT;

CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);

-- RLS: deny direct client access; the service role bypasses it automatically.
-- Every read and write goes through the API routes.
ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestion_votes ENABLE ROW LEVEL SECURITY;
