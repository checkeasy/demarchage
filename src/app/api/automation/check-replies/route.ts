import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrchestrator } from '@/lib/agents/orchestrator';

// POST: Check for new replies and auto-analyze with AI
// Can be called by cron or manually
export async function POST(request: NextRequest) {
  // CRON_SECRET auth check
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();

    // Find recent reply activities that haven't been analyzed yet
    const { data: unreplied, error: fetchError } = await supabase
      .from('prospect_activities')
      .select('id, prospect_id, workspace_id, metadata')
      .eq('activity_type', 'reply_received')
      .is('ai_analyzed', null)
      .order('created_at', { ascending: false })
      .limit(50);

    if (fetchError) {
      console.error('[CheckReplies] Fetch error:', fetchError);
      return NextResponse.json({ error: 'Erreur de lecture des reponses' }, { status: 500 });
    }

    if (!unreplied || unreplied.length === 0) {
      return NextResponse.json({ success: true, analyzed: 0, message: 'Aucune nouvelle reponse' });
    }

    const orchestrator = getOrchestrator();
    let analyzed = 0;
    let errors = 0;

    for (const activity of unreplied) {
      try {
        const metadata = activity.metadata as Record<string, unknown> | null;
        const replyText = (metadata?.reply_text || metadata?.body || '') as string;

        if (!replyText || replyText.trim().length === 0) continue;

        // Get previous interactions for context
        const { data: history } = await supabase
          .from('prospect_activities')
          .select('activity_type, metadata, created_at')
          .eq('prospect_id', activity.prospect_id)
          .in('activity_type', ['email_sent', 'reply_received', 'linkedin_sent'])
          .order('created_at', { ascending: true })
          .limit(10);

        const previousInteractions = (history || []).map(h => {
          const meta = h.metadata as Record<string, unknown> | null;
          return {
            role: h.activity_type === 'reply_received' ? 'prospect' : 'assistant',
            content: (meta?.body || meta?.reply_text || meta?.subject || '') as string,
            sent_at: h.created_at,
          };
        });

        // Analyze with AI
        const analysisResult = await orchestrator.analyzeReply(
          activity.workspace_id,
          activity.prospect_id,
          replyText,
          previousInteractions
        );

        const analysis = analysisResult.content as Record<string, unknown>;

        // Save analysis as a new activity
        await supabase.from('prospect_activities').insert({
          prospect_id: activity.prospect_id,
          workspace_id: activity.workspace_id,
          activity_type: 'ai_reply_analysis',
          metadata: {
            original_activity_id: activity.id,
            ...analysis,
          },
        });

        // Mark the original activity as analyzed
        await supabase
          .from('prospect_activities')
          .update({ ai_analyzed: true } as Record<string, unknown>)
          .eq('id', activity.id);

        // Update prospect status based on sentiment
        const sentiment = analysis.sentiment as string;
        const intent = analysis.intent as string;

        let newStatus: string | null = null;
        if (intent === 'interested' || intent === 'meeting_request') {
          newStatus = 'hot';
        } else if (intent === 'not_interested' || intent === 'unsubscribe') {
          newStatus = 'lost';
        } else if (sentiment === 'positive') {
          newStatus = 'warm';
        }

        if (newStatus) {
          await supabase
            .from('prospects')
            .update({ status: newStatus })
            .eq('id', activity.prospect_id);
        }

        // Auto-log meeting suggestion for hot prospects with meeting intent
        if (intent === 'meeting_request' || (intent === 'interested' && newStatus === 'hot')) {
          await supabase.from('prospect_activities').insert({
            prospect_id: activity.prospect_id,
            workspace_id: activity.workspace_id,
            activity_type: 'meeting_suggested',
            metadata: {
              trigger: 'auto_analysis',
              intent,
              sentiment,
              message: 'Prospect chaud detecte - RDV recommande',
            },
          });
        }

        analyzed++;
      } catch (err) {
        console.error(`[CheckReplies] Error analyzing activity ${activity.id}:`, err);
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      analyzed,
      errors,
      total: unreplied.length,
    });
  } catch (error) {
    console.error('[CheckReplies] Global error:', error);
    return NextResponse.json(
      { error: 'Erreur interne lors de la verification des reponses' },
      { status: 500 }
    );
  }
}
