-- Create prospect_enrichments table for AI research data storage
CREATE TABLE IF NOT EXISTS public.prospect_enrichments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'ai_research',
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prospect_enrichments_prospect_id ON public.prospect_enrichments(prospect_id);
