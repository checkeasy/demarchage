import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import Anthropic from '@anthropic-ai/sdk';

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
      timeout: 60_000,
    });
  }
  return _anthropic;
}

export const maxDuration = 120;

interface ParsedActivity {
  activity_type: string;
  channel: string;
  subject: string;
  body: string;
  date: string;
  metadata: Record<string, unknown>;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
    }

    const { text } = await request.json();

    if (!text || typeof text !== 'string' || text.trim().length < 10) {
      return NextResponse.json({ error: 'Texte d\'historique CRM requis (minimum 10 caracteres)' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Get prospect info
    const { data: prospect } = await admin
      .from('prospects')
      .select('workspace_id, first_name, last_name, company')
      .eq('id', id)
      .single();

    if (!prospect) {
      return NextResponse.json({ error: 'Prospect introuvable' }, { status: 404 });
    }

    // Use Claude to parse the CRM history text into structured activities
    const prompt = `Tu es un parseur d'historique CRM. On te donne un texte brut copie-colle depuis Pipedrive (ou un autre CRM) contenant l'historique d'activites d'un prospect.

Ton travail : extraire CHAQUE activite individuelle et la structurer en JSON.

Pour chaque activite, determine :
- activity_type : un parmi: "call_logged", "email_sent", "reply_received", "meeting_scheduled", "meeting_completed", "note_added", "status_changed", "linkedin_message_sent", "linkedin_connect_sent"
- channel : "phone", "email", "manual", "linkedin"
- subject : un titre court (max 100 chars) resumant l'activite
- body : le contenu complet / notes de l'activite (garde TOUT le detail, ne resume PAS)
- date : la date au format ISO 8601 (YYYY-MM-DDTHH:mm:ssZ). Si seulement jour donne, utilise 12:00:00. Si l'annee manque, suppose 2024 ou 2025 selon le contexte.
- metadata : objet avec des infos supplementaires (duree d'appel, participants, resultat, etc.)

IMPORTANT :
- Garde TOUT le contenu des notes, ne resume rien
- Si une activite a des sous-parties (ex: compte-rendu de reunion avec plusieurs points), garde tout dans body
- Detecte les dates dans differents formats (13 mars, 03/2025, March 13, etc.)
- Si c'est un email envoye PAR le commercial, type = "email_sent". Si c'est une reponse DU prospect, type = "reply_received"
- Si c'est un appel, type = "call_logged"
- Si c'est une reunion / demo / rdv, type = "meeting_completed"
- Les notes simples sans action = "note_added"

Reponds UNIQUEMENT en JSON valide, un tableau d'objets :
[{"activity_type": "...", "channel": "...", "subject": "...", "body": "...", "date": "...", "metadata": {...}}, ...]

Voici le texte CRM a parser :

${text.slice(0, 15000)}`;

    const response = await getAnthropic().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('[Import CRM] No JSON array in response:', responseText.slice(0, 500));
      return NextResponse.json({ error: 'Impossible de parser l\'historique CRM' }, { status: 422 });
    }

    let activities: ParsedActivity[];
    try {
      activities = JSON.parse(jsonMatch[0]);
    } catch {
      console.error('[Import CRM] JSON parse error');
      return NextResponse.json({ error: 'Erreur de parsing JSON' }, { status: 422 });
    }

    if (!Array.isArray(activities) || activities.length === 0) {
      return NextResponse.json({ error: 'Aucune activite detectee dans le texte' }, { status: 422 });
    }

    // Valid activity types from the DB constraint
    const validTypes = new Set([
      'email_sent', 'email_opened', 'email_clicked', 'email_bounced', 'reply_received',
      'linkedin_connect_sent', 'linkedin_connect_accepted', 'linkedin_message_sent',
      'linkedin_reply_received', 'linkedin_profile_viewed',
      'whatsapp_sent', 'whatsapp_delivered', 'whatsapp_read', 'whatsapp_reply_received',
      'ai_reply_analysis', 'ai_research',
      'note_added', 'status_changed', 'call_logged', 'meeting_scheduled', 'meeting_completed',
    ]);

    const validChannels = new Set(['email', 'linkedin', 'whatsapp', 'phone', 'manual', 'ai']);

    // Insert activities
    const toInsert = activities
      .filter(a => a.activity_type && a.body)
      .map(a => ({
        workspace_id: prospect.workspace_id,
        prospect_id: id,
        activity_type: validTypes.has(a.activity_type) ? a.activity_type : 'note_added',
        channel: validChannels.has(a.channel) ? a.channel : 'manual',
        subject: (a.subject || '').slice(0, 500),
        body: a.body || '',
        metadata: {
          ...(a.metadata || {}),
          imported_from: 'pipedrive_paste',
          imported_at: new Date().toISOString(),
        },
        performed_by: user.id,
        created_at: a.date || new Date().toISOString(),
      }));

    if (toInsert.length === 0) {
      return NextResponse.json({ error: 'Aucune activite valide extraite' }, { status: 422 });
    }

    // Insert in batches of 20
    let inserted = 0;
    let errors = 0;
    for (let i = 0; i < toInsert.length; i += 20) {
      const batch = toInsert.slice(i, i + 20);
      const { error: insertError, data } = await admin
        .from('prospect_activities')
        .insert(batch)
        .select('id');

      if (insertError) {
        console.error('[Import CRM] Insert error batch', i, insertError);
        errors += batch.length;
      } else {
        inserted += (data?.length || 0);
      }
    }

    return NextResponse.json({
      success: true,
      total_parsed: activities.length,
      inserted,
      errors,
      message: `${inserted} activite(s) importee(s) depuis l'historique CRM`,
    });
  } catch (err) {
    console.error('[API Import CRM Activities]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur interne' },
      { status: 500 }
    );
  }
}
