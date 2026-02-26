-- ============================================================================
-- 010_rpc_functions.sql
-- RPC functions for atomically incrementing campaign and A/B variant stats
-- ============================================================================

-- ============================================================================
-- 1. INCREMENT CAMPAIGN STAT
-- Safely increments a stat column on the campaigns table
-- Uses a whitelist to prevent SQL injection via column name
-- ============================================================================

CREATE OR REPLACE FUNCTION public.increment_campaign_stat(
    p_campaign_id UUID,
    p_column TEXT
) RETURNS VOID AS $$
BEGIN
    -- Whitelist allowed columns
    IF p_column NOT IN ('total_sent', 'total_opened', 'total_clicked', 'total_replied', 'total_bounced') THEN
        RAISE EXCEPTION 'Invalid column name: %', p_column;
    END IF;

    EXECUTE format(
        'UPDATE public.campaigns SET %I = %I + 1 WHERE id = $1',
        p_column, p_column
    ) USING p_campaign_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. INCREMENT A/B VARIANT STAT
-- Safely increments a stat column on the ab_variants table
-- ============================================================================

CREATE OR REPLACE FUNCTION public.increment_ab_variant_stat(
    p_variant_id UUID,
    p_column TEXT
) RETURNS VOID AS $$
BEGIN
    -- Whitelist allowed columns
    IF p_column NOT IN ('total_sent', 'total_opened', 'total_clicked', 'total_replied') THEN
        RAISE EXCEPTION 'Invalid column name: %', p_column;
    END IF;

    EXECUTE format(
        'UPDATE public.ab_variants SET %I = %I + 1 WHERE id = $1',
        p_column, p_column
    ) USING p_variant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.increment_campaign_stat(UUID, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.increment_ab_variant_stat(UUID, TEXT) TO authenticated, anon;
