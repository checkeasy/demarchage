-- Add warmup_started_at to track the start of warmup for progressive schedule
ALTER TABLE public.email_accounts
    ADD COLUMN IF NOT EXISTS warmup_started_at TIMESTAMPTZ;

-- Set warmup_started_at for already-enabled accounts
UPDATE public.email_accounts
SET warmup_started_at = created_at
WHERE warmup_enabled = TRUE AND warmup_started_at IS NULL;
