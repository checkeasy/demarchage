import { createAdminClient } from '@/lib/supabase/admin';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AggregatedMetrics {
  agent_type: string;
  segment_key: string | null;
  total_generations: number;
  total_tokens_input: number;
  total_tokens_output: number;
  total_cost_usd: number;
  avg_personalization_score: number;
  total_sent: number;
  total_opened: number;
  total_clicked: number;
  total_replied: number;
  total_bounced: number;
}

// ─── Learning Pipeline ──────────────────────────────────────────────────────

/**
 * Aggregates generation logs and email outcomes into performance metrics.
 * Should be called periodically (every 6 hours via cron).
 */
export async function runLearningPipeline(workspaceId: string): Promise<{
  metricsUpdated: number;
  strategiesInvalidated: number;
}> {
  const supabase = createAdminClient();
  let metricsUpdated = 0;
  let strategiesInvalidated = 0;

  // ── Step 1: Aggregate generation logs by agent_type + segment ────────────

  const { data: logs } = await supabase
    .from('agent_generation_log')
    .select('agent_type, segment_key, input_tokens, output_tokens, cost_usd, personalization_score, outcome_open, outcome_click, outcome_reply')
    .eq('workspace_id', workspaceId);

  if (!logs || logs.length === 0) {
    return { metricsUpdated: 0, strategiesInvalidated: 0 };
  }

  // Group by agent_type + segment_key
  const groups = new Map<string, AggregatedMetrics>();

  for (const log of logs) {
    const key = `${log.agent_type}__${log.segment_key || '_all_'}`;

    if (!groups.has(key)) {
      groups.set(key, {
        agent_type: log.agent_type,
        segment_key: log.segment_key || null,
        total_generations: 0,
        total_tokens_input: 0,
        total_tokens_output: 0,
        total_cost_usd: 0,
        avg_personalization_score: 0,
        total_sent: 0,
        total_opened: 0,
        total_clicked: 0,
        total_replied: 0,
        total_bounced: 0,
      });
    }

    const g = groups.get(key)!;
    g.total_generations++;
    g.total_tokens_input += log.input_tokens || 0;
    g.total_tokens_output += log.output_tokens || 0;
    g.total_cost_usd += Number(log.cost_usd) || 0;
    g.avg_personalization_score += log.personalization_score || 0;

    // Count outcomes only if they exist (meaning email was actually sent)
    if (log.outcome_open !== null) {
      g.total_sent++;
      if (log.outcome_open) g.total_opened++;
      if (log.outcome_click) g.total_clicked++;
      if (log.outcome_reply) g.total_replied++;
    }
  }

  // ── Step 2: Upsert metrics into agent_performance_metrics ──────────────

  const now = new Date();
  const periodStart = new Date(now);
  periodStart.setDate(periodStart.getDate() - 7); // Weekly window

  for (const [, metrics] of groups) {
    // Calculate averages and rates
    const avgPersonalization = metrics.total_generations > 0
      ? metrics.avg_personalization_score / metrics.total_generations
      : 0;

    const openRate = metrics.total_sent > 0
      ? (metrics.total_opened / metrics.total_sent) * 100
      : null;
    const clickRate = metrics.total_sent > 0
      ? (metrics.total_clicked / metrics.total_sent) * 100
      : null;
    const replyRate = metrics.total_sent > 0
      ? (metrics.total_replied / metrics.total_sent) * 100
      : null;

    const { error } = await supabase
      .from('agent_performance_metrics')
      .upsert(
        {
          workspace_id: workspaceId,
          agent_type: metrics.agent_type,
          metric_period: 'weekly' as const,
          period_start: periodStart.toISOString().split('T')[0],
          period_end: now.toISOString().split('T')[0],
          segment_key: metrics.segment_key,
          total_generations: metrics.total_generations,
          total_tokens_input: metrics.total_tokens_input,
          total_tokens_output: metrics.total_tokens_output,
          total_cost_usd: metrics.total_cost_usd,
          avg_personalization_score: avgPersonalization,
          total_sent: metrics.total_sent,
          total_opened: metrics.total_opened,
          total_clicked: metrics.total_clicked,
          total_replied: metrics.total_replied,
          total_bounced: metrics.total_bounced,
          open_rate: openRate,
          click_rate: clickRate,
          reply_rate: replyRate,
          winning_patterns: {},
          losing_patterns: {},
        },
        {
          onConflict: 'workspace_id,agent_type,metric_period,period_start,segment_key',
        }
      );

    if (!error) metricsUpdated++;
  }

  // ── Step 3: Check if any segment's performance dropped significantly ────

  const { data: strategies } = await supabase
    .from('agent_strategies')
    .select('id, segment_key, performance_snapshot')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true);

  if (strategies) {
    for (const strategy of strategies) {
      const metrics = groups.get(`email_writer__${strategy.segment_key}`)
        || groups.get(`linkedin_writer__${strategy.segment_key}`);
      if (!metrics || metrics.total_sent < 20) continue;

      const currentReplyRate = metrics.total_sent > 0
        ? (metrics.total_replied / metrics.total_sent) * 100
        : 0;

      const snapshot = strategy.performance_snapshot as Record<string, number> | null;
      const previousReplyRate = snapshot?.replyRate || 0;

      // If reply rate dropped >20%, invalidate the strategy
      if (previousReplyRate > 0 && currentReplyRate < previousReplyRate * 0.8) {
        await supabase
          .from('agent_strategies')
          .update({ is_active: false })
          .eq('id', strategy.id);

        strategiesInvalidated++;
        console.log(
          `[Learning] Strategy ${strategy.segment_key} invalidated: reply rate dropped from ${previousReplyRate.toFixed(1)}% to ${currentReplyRate.toFixed(1)}%`
        );
      }
    }
  }

  return { metricsUpdated, strategiesInvalidated };
}

/**
 * Links email outcomes (opens, clicks, replies) back to agent generations.
 * Should be called after webhook/tracking events update the emails_sent table.
 */
export async function syncOutcomesToGenerations(workspaceId: string): Promise<number> {
  const supabase = createAdminClient();
  let synced = 0;

  // Find generations that haven't had outcomes synced yet
  const { data: unsynced } = await supabase
    .from('agent_generation_log')
    .select('id, prospect_id, campaign_id')
    .eq('workspace_id', workspaceId)
    .in('agent_type', ['email_writer', 'linkedin_writer'])
    .is('outcome_open', null)
    .eq('was_used', true);

  if (!unsynced || unsynced.length === 0) return 0;

  for (const gen of unsynced) {
    if (!gen.prospect_id || !gen.campaign_id) continue;

    // Find campaign_prospect entries that match this prospect + campaign
    const { data: campaignProspects } = await supabase
      .from('campaign_prospects')
      .select('id')
      .eq('prospect_id', gen.prospect_id)
      .eq('campaign_id', gen.campaign_id);

    if (!campaignProspects || campaignProspects.length === 0) continue;

    const cpIds = campaignProspects.map((cp) => cp.id);

    // Find the most recent email sent for these campaign_prospect entries
    const { data: emails } = await supabase
      .from('emails_sent')
      .select('opened_at, clicked_at, replied_at')
      .in('campaign_prospect_id', cpIds)
      .order('created_at', { ascending: false })
      .limit(1);

    if (emails && emails.length > 0) {
      const e = emails[0];
      const { error } = await supabase
        .from('agent_generation_log')
        .update({
          outcome_open: !!e.opened_at,
          outcome_click: !!e.clicked_at,
          outcome_reply: !!e.replied_at,
        })
        .eq('id', gen.id);

      if (!error) synced++;
    }
  }

  return synced;
}
