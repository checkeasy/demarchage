-- Email reliability score column
-- Scores 0-100 based on DNS MX verification, domain type, email pattern analysis
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS email_score INTEGER DEFAULT NULL
  CHECK (email_score >= 0 AND email_score <= 100);

CREATE INDEX IF NOT EXISTS idx_prospects_email_score ON prospects (email_score)
  WHERE email_score IS NOT NULL;

COMMENT ON COLUMN prospects.email_score IS 'Email reliability score 0-100 based on DNS MX, domain type, pattern analysis';
