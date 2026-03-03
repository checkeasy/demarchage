import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import Anthropic from '@anthropic-ai/sdk';

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
      timeout: 30_000,
    });
  }
  return _anthropic;
}

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
    }

    const { prospectIds } = await request.json();

    if (!Array.isArray(prospectIds) || prospectIds.length === 0) {
      return NextResponse.json({ error: 'prospectIds requis' }, { status: 400 });
    }

    if (prospectIds.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 prospects par lot' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Fetch prospects
    const { data: prospects, error: fetchError } = await admin
      .from('prospects')
      .select('id, first_name, last_name, company, job_title, location, city, industry, employee_count, lead_score, linkedin_url, website, phone, nb_properties, pipeline_stage, loss_reason, source, custom_fields')
      .in('id', prospectIds);

    if (fetchError || !prospects) {
      return NextResponse.json({ error: 'Erreur lecture prospects' }, { status: 500 });
    }

    // Filter prospects that need enrichment
    const toEnrich = prospects.filter(p =>
      !p.industry || !p.employee_count || p.lead_score === null
    );

    if (toEnrich.length === 0) {
      return NextResponse.json({ success: true, enriched: 0, errors: 0, message: 'Tous les prospects sont deja enrichis' });
    }

    let enriched = 0;
    let errors = 0;

    // Process in batches of 5 for parallel API calls
    for (let i = 0; i < toEnrich.length; i += 5) {
      const batch = toEnrich.slice(i, i + 5);
      const results = await Promise.allSettled(
        batch.map(async (prospect) => {
          const cf = (prospect.custom_fields || {}) as Record<string, unknown>;
          const otaListings = cf.ota_listings as Record<string, number | null> | undefined;
          const otaInfo = otaListings ? Object.entries(otaListings).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(', ') : '';

          const prompt = `Analyse ce prospect B2B et determine:
1. industry: le secteur d'activite (ex: Immobilier, SaaS, Construction, Tourisme, Restauration, Commerce, Sante, Finance, Education, Consulting, Industrie, Transport, Autre)
2. employee_count: la taille estimee de l'entreprise (1-10, 11-50, 51-200, 201-500, 500+)
3. lead_score: un score de 0 a 100. CRITERES IMPORTANTS pour le score:
   - Completude du profil (email, telephone, LinkedIn, site web)
   - Taille de l'entreprise / nombre de biens geres
   - Etape pipeline (plus avance = plus chaud)
   - Retour commercial : si le commercial a note "PAS LA CIBLE", "pas interesse", "n'existe plus" → score tres bas (0-15). Si "en nego", "demo faite" → score eleve (70+)
   - Un prospect avec beaucoup de biens geres et un vrai email est plus interessant

Informations disponibles:
- Nom: ${prospect.first_name || ''} ${prospect.last_name || ''}
- Entreprise: ${prospect.company || 'Inconnue'}
- Poste: ${prospect.job_title || 'Inconnu'}
- Ville: ${prospect.city || prospect.location || 'Inconnue'}
- LinkedIn: ${prospect.linkedin_url || 'Non disponible'}
- Site web: ${prospect.website || 'Non disponible'}
- Telephone: ${prospect.phone || 'Non disponible'}
- Nb biens geres: ${prospect.nb_properties ?? 'Inconnu'}
- Etape pipeline: ${prospect.pipeline_stage || 'Aucune'}
- Source: ${prospect.source || 'Inconnue'}
- Retour commercial: ${prospect.loss_reason || 'Aucun retour'}${otaInfo ? `\n- Listings OTA: ${otaInfo}` : ''}

Reponds UNIQUEMENT en JSON valide: {"industry": "...", "employee_count": "...", "lead_score": 0}`;

          const response = await getAnthropic().messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 200,
            temperature: 0.3,
            messages: [{ role: 'user', content: prompt }],
          });

          const text = response.content[0].type === 'text' ? response.content[0].text : '';
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (!jsonMatch) throw new Error('No JSON in response');

          const parsed = JSON.parse(jsonMatch[0]);

          const updates: Record<string, unknown> = {};
          if (parsed.industry && !prospect.industry) updates.industry = parsed.industry;
          if (parsed.employee_count && !prospect.employee_count) updates.employee_count = parsed.employee_count;
          if (parsed.lead_score !== undefined && prospect.lead_score === null) {
            const score = Math.max(0, Math.min(100, Math.round(parsed.lead_score)));
            updates.lead_score = score;
          }

          if (Object.keys(updates).length > 0) {
            const { error: updateError } = await admin
              .from('prospects')
              .update(updates)
              .eq('id', prospect.id);

            if (updateError) throw updateError;
          }

          return true;
        })
      );

      for (const r of results) {
        if (r.status === 'fulfilled') enriched++;
        else errors++;
      }
    }

    return NextResponse.json({ success: true, enriched, errors });
  } catch (err) {
    console.error('[API Enrich Batch]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur interne' },
      { status: 500 }
    );
  }
}
