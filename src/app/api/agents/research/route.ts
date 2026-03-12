import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrchestrator } from '@/lib/agents/orchestrator';
import { enrichProspectFromWeb, CONFIDENCE_THRESHOLD } from '@/lib/search/prospect-enrichment';

// POST: Research a prospect
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single();

    const workspaceId = profile?.current_workspace_id;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Aucun workspace actif' }, { status: 400 });
    }

    const body = await request.json();
    const { prospectId } = body;

    // Validate required fields
    if (!prospectId) {
      return NextResponse.json(
        { error: 'Le champ "prospectId" est requis' },
        { status: 400 }
      );
    }

    // 1. Fetch prospect data for enrichment
    const { data: prospect } = await supabase
      .from('prospects')
      .select('*')
      .eq('id', prospectId)
      .eq('workspace_id', workspaceId)
      .single();

    if (!prospect) {
      return NextResponse.json({ error: 'Prospect non trouve' }, { status: 404 });
    }

    // 2. Run web enrichment (LinkedIn + email search) in parallel with AI research
    const enrichmentPromise = enrichProspectFromWeb({
      firstName: prospect.first_name,
      lastName: prospect.last_name,
      company: prospect.company,
      jobTitle: prospect.job_title,
      location: prospect.location || prospect.city,
      website: prospect.website,
      existingEmail: prospect.email,
      existingLinkedin: prospect.linkedin_url,
    }).catch((err) => {
      console.error('[Agents] Enrichment error (non-blocking):', err);
      return null;
    });

    const orchestrator = getOrchestrator();

    const [research, enrichment] = await Promise.all([
      orchestrator.researchProspect(workspaceId, prospectId),
      enrichmentPromise,
    ]);

    // 3. If enrichment found high-confidence results, update the prospect
    let enrichmentUpdates: Record<string, unknown> = {};
    if (enrichment) {
      if (enrichment.linkedin_url && !prospect.linkedin_url) {
        enrichmentUpdates.linkedin_url = enrichment.linkedin_url;
      }
      if (enrichment.email && !prospect.email) {
        enrichmentUpdates.email = enrichment.email;
      }

      // Save enrichment data in custom_fields for transparency
      const customFields = (prospect.custom_fields || {}) as Record<string, unknown>;
      enrichmentUpdates.custom_fields = {
        ...customFields,
        web_enrichment: {
          linkedin_url: enrichment.linkedin_url,
          linkedin_confidence: enrichment.linkedin_confidence,
          email: enrichment.email,
          email_confidence: enrichment.email_confidence,
          sources: enrichment.sources,
          reasoning: enrichment.reasoning,
          enriched_at: new Date().toISOString(),
          confidence_threshold: CONFIDENCE_THRESHOLD,
        },
      };

      if (Object.keys(enrichmentUpdates).length > 0) {
        await supabase
          .from('prospects')
          .update(enrichmentUpdates)
          .eq('id', prospectId);
      }
    }

    // 4. Add enrichment info to the research result
    const researchContent = research.content as Record<string, unknown>;
    if (enrichment) {
      researchContent.web_enrichment = {
        linkedin_url: enrichment.linkedin_url,
        linkedin_confidence: enrichment.linkedin_confidence,
        email: enrichment.email,
        email_confidence: enrichment.email_confidence,
        reasoning: enrichment.reasoning,
      };
    }

    // 5. Save contact_type if AI classified it
    const aiContactType = researchContent.contact_type as string | undefined;
    const validContactTypes = ['prospect', 'lead_chaud', 'client', 'ancien_client', 'partenaire', 'concurrent', 'influenceur', 'a_recontacter', 'mauvaise_cible'];
    if (aiContactType && validContactTypes.includes(aiContactType)) {
      await supabase
        .from('prospects')
        .update({ contact_type: aiContactType })
        .eq('id', prospectId);
    }

    // 6. Handle auto-deletion if AI recommends it
    const shouldDelete = researchContent.should_delete === true;
    const deleteReason = (researchContent.delete_reason as string) || '';

    if (shouldDelete) {
      // First unenroll from any active campaigns
      const { data: enrollments } = await supabase
        .from('campaign_prospects')
        .select('id, campaign_id')
        .eq('prospect_id', prospectId)
        .in('status', ['active', 'pending']);

      if (enrollments && enrollments.length > 0) {
        await supabase
          .from('campaign_prospects')
          .delete()
          .in('id', enrollments.map(e => e.id));
      }

      // Delete the prospect
      await supabase
        .from('prospects')
        .delete()
        .eq('id', prospectId)
        .eq('workspace_id', workspaceId);

      return NextResponse.json({
        success: true,
        research,
        deleted: true,
        delete_reason: deleteReason,
      });
    }

    return NextResponse.json({ success: true, research });
  } catch (error) {
    console.error('[Agents] Research error:', error);

    if (error instanceof Error) {
      if (error.message.includes('API key') || error.message.includes('api_key')) {
        return NextResponse.json(
          { error: 'Cle API Anthropic invalide ou manquante' },
          { status: 500 }
        );
      }
      if (error.message.includes('rate limit') || error.message.includes('429')) {
        return NextResponse.json(
          { error: 'Limite de requetes atteinte. Veuillez reessayer dans quelques instants.' },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Erreur interne du serveur lors de la recherche prospect' },
      { status: 500 }
    );
  }
}
