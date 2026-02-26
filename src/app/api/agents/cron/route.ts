import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runLearningPipeline, syncOutcomesToGenerations } from '@/lib/agents/learning-pipeline';

/**
 * Cron job endpoint for the agent learning pipeline.
 * Call every 6 hours via Railway cron or external cron service.
 *
 * Authorization: requires CRON_SECRET header to match env var.
 *
 * What it does:
 * 1. Syncs email outcomes (opens/clicks/replies) to agent generation logs
 * 2. Aggregates metrics by agent type and segment
 * 3. Invalidates underperforming strategies (>20% drop in reply rate)
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check - simple secret for cron jobs
    const cronSecret = request.headers.get('x-cron-secret') || request.headers.get('authorization')?.replace('Bearer ', '');
    if (cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Get all workspaces
    const { data: workspaces } = await supabase
      .from('workspaces')
      .select('id, name');

    if (!workspaces || workspaces.length === 0) {
      return NextResponse.json({ message: 'Aucun workspace' });
    }

    const results = [];

    for (const workspace of workspaces) {
      // Step 1: Sync outcomes
      const synced = await syncOutcomesToGenerations(workspace.id);

      // Step 2: Run learning pipeline
      const pipeline = await runLearningPipeline(workspace.id);

      results.push({
        workspace: workspace.name,
        outcomesSynced: synced,
        metricsUpdated: pipeline.metricsUpdated,
        strategiesInvalidated: pipeline.strategiesInvalidated,
      });
    }

    return NextResponse.json({
      success: true,
      processedAt: new Date().toISOString(),
      workspaces: results,
    });
  } catch (err) {
    console.error('[Cron agent-learning] Error:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
