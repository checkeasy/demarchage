-- Fix: campaign_prospects.current_step_id FK should SET NULL on delete
-- Without this, deleting sequence_steps fails with 23503 when prospects reference them

ALTER TABLE public.campaign_prospects
    DROP CONSTRAINT IF EXISTS campaign_prospects_current_step_id_fkey;

ALTER TABLE public.campaign_prospects
    ADD CONSTRAINT campaign_prospects_current_step_id_fkey
    FOREIGN KEY (current_step_id)
    REFERENCES public.sequence_steps (id)
    ON DELETE SET NULL;

-- Also fix emails_sent.step_id FK (same issue)
ALTER TABLE public.emails_sent
    DROP CONSTRAINT IF EXISTS emails_sent_step_id_fkey;

ALTER TABLE public.emails_sent
    ADD CONSTRAINT emails_sent_step_id_fkey
    FOREIGN KEY (step_id)
    REFERENCES public.sequence_steps (id)
    ON DELETE SET NULL;
