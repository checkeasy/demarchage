import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrchestrator } from '@/lib/agents/orchestrator';
import { analyzeWebsite } from '@/lib/scraper/website-analyzer';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// POST: Batch research prospects (e.g. all prospects in a campaign)
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
    const { prospectIds, campaignId, skipAlreadyAnalyzed = true } = body;

    // Accept either prospectIds directly or campaignId to fetch them
    let idsToProcess: string[] = [];

    if (prospectIds && Array.isArray(prospectIds)) {
      idsToProcess = prospectIds;
    } else if (campaignId) {
      const adminSupabase = createAdminClient();
      const { data: campaignProspects } = await adminSupabase
        .from('campaign_prospects')
        .select('prospect_id')
        .eq('campaign_id', campaignId);

      idsToProcess = (campaignProspects || []).map((cp) => cp.prospect_id);
    } else {
      return NextResponse.json(
        { error: 'Fournir "prospectIds" ou "campaignId"' },
        { status: 400 }
      );
    }

    if (idsToProcess.length === 0) {
      return NextResponse.json({ success: true, analyzed: 0, skipped: 0, errors: [] });
    }

    // Cap at 100 prospects per batch
    if (idsToProcess.length > 100) {
      idsToProcess = idsToProcess.slice(0, 100);
    }

    // If skipAlreadyAnalyzed, filter out prospects that already have ai_research
    let skipped = 0;
    if (skipAlreadyAnalyzed) {
      const adminSupabase = createAdminClient();
      const { data: prospects } = await adminSupabase
        .from('prospects')
        .select('id, custom_fields')
        .in('id', idsToProcess);

      const alreadyAnalyzed = new Set<string>();
      for (const p of prospects || []) {
        const cf = (p.custom_fields || {}) as Record<string, unknown>;
        if (cf.ai_research) {
          alreadyAnalyzed.add(p.id);
        }
      }

      const before = idsToProcess.length;
      idsToProcess = idsToProcess.filter((id) => !alreadyAnalyzed.has(id));
      skipped = before - idsToProcess.length;
    }

    const orchestrator = getOrchestrator();
    const adminSupabase = createAdminClient();
    let analyzed = 0;
    const errors: { prospectId: string; error: string }[] = [];

    for (let i = 0; i < idsToProcess.length; i++) {
      const prospectId = idsToProcess[i];

      try {
        // Step 1: Fetch prospect to get website URL
        const { data: prospect } = await adminSupabase
          .from('prospects')
          .select('website, organization, custom_fields')
          .eq('id', prospectId)
          .single();

        const existingFields = (prospect?.custom_fields || {}) as Record<string, unknown>;

        // Step 2: Scrape website if available and not already scraped
        const websiteUrl = prospect?.website || (prospect?.organization ? `https://${prospect.organization}` : null);
        let websiteData: Record<string, unknown> | null = existingFields.website_analysis as Record<string, unknown> | null;

        if (websiteUrl && !websiteData) {
          try {
            const analysis = await analyzeWebsite(websiteUrl);
            websiteData = {
              url: websiteUrl,
              title: analysis.scrapedData?.title || null,
              description: analysis.scrapedData?.metaDescription || null,
              services: analysis.aiAnalysis?.products_services || [],
              industry: analysis.aiAnalysis?.industry || null,
              companyDescription: analysis.aiAnalysis?.company_description || null,
              painPoints: analysis.aiAnalysis?.pain_points || [],
              relevanceScore: analysis.aiAnalysis?.checkeasy_relevance?.score || null,
              companySize: analysis.aiAnalysis?.company_info?.estimated_size || null,
              digitalMaturity: analysis.aiAnalysis?.company_info?.digital_maturity || null,
              techStack: analysis.scrapedData?.techStackIndicators || [],
              socialLinks: analysis.scrapedData?.socialLinks || {},
              contactEmails: analysis.scrapedData?.contactInfo?.emails || [],
              language: analysis.scrapedData?.language || null,
              analyzedAt: new Date().toISOString(),
            };

            // Save website analysis immediately
            await adminSupabase
              .from('prospects')
              .update({
                custom_fields: { ...existingFields, website_analysis: websiteData },
              })
              .eq('id', prospectId);
          } catch {
            // Website scraping failed, continue without it
          }
        }

        // Step 3: Run AI research (will use enrichments including website data)
        const result = await orchestrator.researchProspect(workspaceId, prospectId);

        // Step 4: Save research + website data
        // Re-fetch custom_fields in case website_analysis was just added
        const { data: updatedProspect } = await adminSupabase
          .from('prospects')
          .select('custom_fields')
          .eq('id', prospectId)
          .single();

        const latestFields = (updatedProspect?.custom_fields || {}) as Record<string, unknown>;
        const updatedFields = {
          ...latestFields,
          ai_research: result.content,
          ai_research_at: new Date().toISOString(),
        };

        // Also update lead_score from ICP score if available
        const icpScore = (result.content as Record<string, unknown>)?.icp_score;
        const updateData: Record<string, unknown> = { custom_fields: updatedFields };
        if (typeof icpScore === 'number') {
          updateData.lead_score = icpScore;
        }

        await adminSupabase
          .from('prospects')
          .update(updateData)
          .eq('id', prospectId);

        analyzed++;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
        errors.push({ prospectId, error: errorMessage });
      }

      // Rate limit delay
      if (i < idsToProcess.length - 1) {
        await delay(1000);
      }
    }

    return NextResponse.json({
      success: true,
      analyzed,
      skipped,
      errors,
      total: analyzed + skipped + errors.length,
    });
  } catch (error) {
    console.error('[Agents] Batch research error:', error);

    if (error instanceof Error) {
      if (error.message.includes('API key') || error.message.includes('api_key')) {
        return NextResponse.json(
          { error: 'Cle API Anthropic invalide ou manquante' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
