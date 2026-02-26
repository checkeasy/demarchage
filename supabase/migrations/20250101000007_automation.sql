-- ============================================
-- 007_automation.sql
-- LinkedIn automation sequences, actions log, scraping sessions
-- ============================================

-- Automation sequences (automated outreach workflows)
CREATE TABLE automation_sequences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'error')),

  -- Configuration
  daily_connection_limit INTEGER DEFAULT 20,
  daily_message_limit INTEGER DEFAULT 50,
  daily_view_limit INTEGER DEFAULT 80,
  sending_window_start TIME DEFAULT '08:00',
  sending_window_end TIME DEFAULT '18:00',
  sending_days INTEGER[] DEFAULT '{1,2,3,4,5}',
  min_delay_seconds INTEGER DEFAULT 2,
  max_delay_seconds INTEGER DEFAULT 8,

  -- Stats (denormalized)
  total_prospects INTEGER DEFAULT 0,
  total_processed INTEGER DEFAULT 0,
  total_connected INTEGER DEFAULT 0,
  total_replied INTEGER DEFAULT 0,
  total_meetings INTEGER DEFAULT 0,

  -- LinkedIn account used
  linkedin_account_id UUID,

  created_by UUID REFERENCES auth.users(id),
  launched_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_automation_sequences_workspace ON automation_sequences(workspace_id);
CREATE INDEX idx_automation_sequences_status ON automation_sequences(workspace_id, status);

-- Automation steps (what to do in sequence)
CREATE TABLE automation_steps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sequence_id UUID NOT NULL REFERENCES automation_sequences(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('view_profile', 'connect', 'message', 'email', 'wait', 'check_accepted', 'like_post')),

  -- Delay before this step (from previous step)
  delay_days INTEGER DEFAULT 0,
  delay_hours INTEGER DEFAULT 0,
  delay_minutes INTEGER DEFAULT 0,

  -- Message content (for connect/message/email steps)
  message_template TEXT,
  subject_template TEXT, -- for email steps
  use_ai_generation BOOLEAN DEFAULT false,
  ai_prompt_context TEXT, -- additional context for AI generation

  -- Condition (for check_accepted step)
  condition_type TEXT CHECK (condition_type IN ('connected', 'not_connected', 'replied', 'not_replied')),
  on_true_step_id UUID,
  on_false_step_id UUID,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(sequence_id, step_order)
);

CREATE INDEX idx_automation_steps_sequence ON automation_steps(sequence_id);

-- Automation prospect enrollment (link prospect to automation)
CREATE TABLE automation_prospects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sequence_id UUID NOT NULL REFERENCES automation_sequences(id) ON DELETE CASCADE,
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,

  current_step_id UUID REFERENCES automation_steps(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'completed', 'connected', 'replied', 'meeting', 'error', 'skipped')),

  -- Scheduling
  next_action_at TIMESTAMPTZ,

  -- Tracking
  profile_viewed BOOLEAN DEFAULT false,
  connection_sent BOOLEAN DEFAULT false,
  connection_accepted BOOLEAN DEFAULT false,
  message_sent_count INTEGER DEFAULT 0,
  has_replied BOOLEAN DEFAULT false,
  meeting_booked BOOLEAN DEFAULT false,

  -- LinkedIn-specific data
  linkedin_profile_urn TEXT,
  linkedin_public_id TEXT,

  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(sequence_id, prospect_id)
);

CREATE INDEX idx_auto_prospects_sequence ON automation_prospects(sequence_id);
CREATE INDEX idx_auto_prospects_prospect ON automation_prospects(prospect_id);
CREATE INDEX idx_auto_prospects_next_action ON automation_prospects(next_action_at) WHERE status = 'active';
CREATE INDEX idx_auto_prospects_status ON automation_prospects(status);

-- Actions log (every LinkedIn action taken)
CREATE TABLE automation_actions_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  sequence_id UUID REFERENCES automation_sequences(id) ON DELETE SET NULL,
  prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL,
  automation_prospect_id UUID REFERENCES automation_prospects(id) ON DELETE SET NULL,
  step_id UUID REFERENCES automation_steps(id) ON DELETE SET NULL,

  action_type TEXT NOT NULL CHECK (action_type IN ('search', 'view_profile', 'connect', 'message', 'email', 'withdraw', 'like_post', 'check_accepted')),
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'failed', 'rate_limited', 'skipped')),

  -- Details
  message_sent TEXT,
  error_message TEXT,
  linkedin_response JSONB,

  -- Metadata
  ip_address TEXT,
  user_agent TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_actions_log_workspace ON automation_actions_log(workspace_id);
CREATE INDEX idx_actions_log_sequence ON automation_actions_log(sequence_id);
CREATE INDEX idx_actions_log_prospect ON automation_actions_log(prospect_id);
CREATE INDEX idx_actions_log_type ON automation_actions_log(action_type);
CREATE INDEX idx_actions_log_created ON automation_actions_log(created_at DESC);

-- LinkedIn accounts (store multiple LinkedIn session configs)
CREATE TABLE linkedin_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- e.g. "Compte principal"
  linkedin_email TEXT,
  li_at_cookie TEXT NOT NULL, -- encrypted at rest
  jsessionid_cookie TEXT NOT NULL, -- encrypted at rest
  proxy_url TEXT,
  user_agent TEXT DEFAULT 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',

  -- Limits
  daily_connection_limit INTEGER DEFAULT 20,
  daily_message_limit INTEGER DEFAULT 50,
  daily_view_limit INTEGER DEFAULT 80,
  daily_search_limit INTEGER DEFAULT 30,

  -- Usage tracking (resets daily)
  connections_today INTEGER DEFAULT 0,
  messages_today INTEGER DEFAULT 0,
  views_today INTEGER DEFAULT 0,
  searches_today INTEGER DEFAULT 0,
  last_reset_date DATE DEFAULT CURRENT_DATE,

  -- Health
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  session_valid BOOLEAN DEFAULT true,
  session_checked_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_linkedin_accounts_workspace ON linkedin_accounts(workspace_id);

-- Scraping sessions (track search/scraping batches)
CREATE TABLE scraping_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  linkedin_account_id UUID REFERENCES linkedin_accounts(id),

  -- Search parameters
  search_params JSONB NOT NULL, -- {keywords, title, location, industry, companySize, ...}

  -- Results
  total_results INTEGER DEFAULT 0,
  profiles_scraped INTEGER DEFAULT 0,
  profiles_saved INTEGER DEFAULT 0,
  profiles_enriched INTEGER DEFAULT 0,

  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'paused', 'error')),
  error_message TEXT,

  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scraping_sessions_workspace ON scraping_sessions(workspace_id);

-- AI generations log (track AI-generated content)
CREATE TABLE ai_generations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL,

  generation_type TEXT NOT NULL CHECK (generation_type IN ('connection_message', 'followup_message', 'email_sequence', 'icebreaker', 'profile_analysis', 'website_analysis')),

  -- Input
  input_data JSONB NOT NULL,

  -- Output
  output_data JSONB NOT NULL,

  -- Usage
  model TEXT DEFAULT 'gpt-5-mini-2025-08-07',
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,

  -- Was the generated content used?
  was_used BOOLEAN DEFAULT false,
  was_edited BOOLEAN DEFAULT false,
  edited_content TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_generations_workspace ON ai_generations(workspace_id);
CREATE INDEX idx_ai_generations_type ON ai_generations(generation_type);

-- Daily LinkedIn usage stats (for tracking limits)
CREATE TABLE linkedin_daily_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  linkedin_account_id UUID NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  connections_sent INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  profiles_viewed INTEGER DEFAULT 0,
  searches_performed INTEGER DEFAULT 0,
  connections_accepted INTEGER DEFAULT 0,
  replies_received INTEGER DEFAULT 0,
  UNIQUE(linkedin_account_id, date)
);

CREATE INDEX idx_linkedin_daily_usage ON linkedin_daily_usage(linkedin_account_id, date);

-- Function to reset daily LinkedIn counters
CREATE OR REPLACE FUNCTION reset_linkedin_daily_counters()
RETURNS VOID AS $$
BEGIN
  UPDATE linkedin_accounts
  SET connections_today = 0,
      messages_today = 0,
      views_today = 0,
      searches_today = 0,
      last_reset_date = CURRENT_DATE
  WHERE last_reset_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment LinkedIn usage
CREATE OR REPLACE FUNCTION increment_linkedin_usage(
  p_account_id UUID,
  p_action_type TEXT
) RETURNS VOID AS $$
BEGIN
  -- Reset counters if new day
  PERFORM reset_linkedin_daily_counters();

  -- Increment account counter
  CASE p_action_type
    WHEN 'connect' THEN
      UPDATE linkedin_accounts SET connections_today = connections_today + 1, last_used_at = NOW() WHERE id = p_account_id;
    WHEN 'message' THEN
      UPDATE linkedin_accounts SET messages_today = messages_today + 1, last_used_at = NOW() WHERE id = p_account_id;
    WHEN 'view_profile' THEN
      UPDATE linkedin_accounts SET views_today = views_today + 1, last_used_at = NOW() WHERE id = p_account_id;
    WHEN 'search' THEN
      UPDATE linkedin_accounts SET searches_today = searches_today + 1, last_used_at = NOW() WHERE id = p_account_id;
    ELSE NULL;
  END CASE;

  -- Also log in daily usage table
  INSERT INTO linkedin_daily_usage (linkedin_account_id, date)
  VALUES (p_account_id, CURRENT_DATE)
  ON CONFLICT (linkedin_account_id, date) DO NOTHING;

  CASE p_action_type
    WHEN 'connect' THEN
      UPDATE linkedin_daily_usage SET connections_sent = connections_sent + 1
      WHERE linkedin_account_id = p_account_id AND date = CURRENT_DATE;
    WHEN 'message' THEN
      UPDATE linkedin_daily_usage SET messages_sent = messages_sent + 1
      WHERE linkedin_account_id = p_account_id AND date = CURRENT_DATE;
    WHEN 'view_profile' THEN
      UPDATE linkedin_daily_usage SET profiles_viewed = profiles_viewed + 1
      WHERE linkedin_account_id = p_account_id AND date = CURRENT_DATE;
    WHEN 'search' THEN
      UPDATE linkedin_daily_usage SET searches_performed = searches_performed + 1
      WHERE linkedin_account_id = p_account_id AND date = CURRENT_DATE;
    ELSE NULL;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Automation queue view (prospects ready for next action)
CREATE OR REPLACE VIEW automation_queue AS
SELECT
  ap.id AS automation_prospect_id,
  ap.sequence_id,
  ap.prospect_id,
  ap.current_step_id,
  ap.next_action_at,
  ap.linkedin_profile_urn,
  ap.linkedin_public_id,
  ap.profile_viewed,
  ap.connection_sent,
  ap.connection_accepted,
  ap.message_sent_count,
  as2.name AS sequence_name,
  as2.status AS sequence_status,
  as2.linkedin_account_id,
  as2.min_delay_seconds,
  as2.max_delay_seconds,
  astep.action_type AS step_action_type,
  astep.message_template,
  astep.subject_template,
  astep.use_ai_generation,
  astep.ai_prompt_context,
  p.first_name,
  p.last_name,
  p.email AS prospect_email,
  p.company,
  p.job_title,
  p.linkedin_url,
  p.custom_fields
FROM automation_prospects ap
JOIN automation_sequences as2 ON as2.id = ap.sequence_id
JOIN automation_steps astep ON astep.id = ap.current_step_id
JOIN prospects p ON p.id = ap.prospect_id
WHERE ap.status = 'active'
  AND ap.next_action_at <= NOW()
  AND as2.status = 'active'
  AND astep.is_active = true;

-- Enable RLS on all new tables
ALTER TABLE automation_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_actions_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraping_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_daily_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies (using get_user_workspace_ids from migration 002)

-- automation_sequences
CREATE POLICY "workspace_access" ON automation_sequences
  FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids()));

-- automation_steps
CREATE POLICY "workspace_access" ON automation_steps
  FOR ALL USING (sequence_id IN (
    SELECT id FROM automation_sequences WHERE workspace_id IN (SELECT get_user_workspace_ids())
  ));

-- automation_prospects
CREATE POLICY "workspace_access" ON automation_prospects
  FOR ALL USING (sequence_id IN (
    SELECT id FROM automation_sequences WHERE workspace_id IN (SELECT get_user_workspace_ids())
  ));

-- automation_actions_log
CREATE POLICY "workspace_access" ON automation_actions_log
  FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids()));

-- linkedin_accounts
CREATE POLICY "workspace_access" ON linkedin_accounts
  FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids()));

-- scraping_sessions
CREATE POLICY "workspace_access" ON scraping_sessions
  FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids()));

-- ai_generations
CREATE POLICY "workspace_access" ON ai_generations
  FOR ALL USING (workspace_id IN (SELECT get_user_workspace_ids()));

-- linkedin_daily_usage
CREATE POLICY "workspace_access" ON linkedin_daily_usage
  FOR ALL USING (linkedin_account_id IN (
    SELECT id FROM linkedin_accounts WHERE workspace_id IN (SELECT get_user_workspace_ids())
  ));

-- Updated_at triggers
CREATE TRIGGER set_updated_at BEFORE UPDATE ON automation_sequences
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON automation_prospects
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON linkedin_accounts
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Grants
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON automation_sequences TO anon, authenticated;
GRANT ALL ON automation_steps TO anon, authenticated;
GRANT ALL ON automation_prospects TO anon, authenticated;
GRANT ALL ON automation_actions_log TO anon, authenticated;
GRANT ALL ON linkedin_accounts TO anon, authenticated;
GRANT ALL ON scraping_sessions TO anon, authenticated;
GRANT ALL ON ai_generations TO anon, authenticated;
GRANT ALL ON linkedin_daily_usage TO anon, authenticated;
GRANT SELECT ON automation_queue TO anon, authenticated;
