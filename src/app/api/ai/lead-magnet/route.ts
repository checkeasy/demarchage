import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

const LEAD_MAGNET_TYPES = ['checklist', 'mini_guide', 'template', 'audit_framework'] as const;

const TYPE_LABELS: Record<string, string> = {
  checklist: 'Checklist actionnable',
  mini_guide: 'Mini-guide pratique',
  template: 'Template pret a l\'emploi',
  audit_framework: 'Framework d\'audit',
};

// POST: Generate a new lead magnet
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
    const { segment_name, industry, pain_points, lead_magnet_type } = body;

    if (!segment_name || !industry || !lead_magnet_type) {
      return NextResponse.json(
        { error: 'Les champs segment_name, industry et lead_magnet_type sont requis' },
        { status: 400 }
      );
    }

    if (!LEAD_MAGNET_TYPES.includes(lead_magnet_type)) {
      return NextResponse.json(
        { error: 'Type de lead magnet invalide' },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Cle API Anthropic manquante' }, { status: 500 });
    }

    const anthropic = new Anthropic({ apiKey });

    const painPointsList = (pain_points || []).map((p: string) => `- ${p}`).join('\n');
    const typeLabel = TYPE_LABELS[lead_magnet_type] || lead_magnet_type;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: `Tu es un expert en marketing B2B pour les PME/TPE en France.

Genere un lead magnet de type "${typeLabel}" pour le segment suivant :

**Segment** : ${segment_name}
**Industrie** : ${industry}
**Pain points** :
${painPointsList || '- Non specifies'}

Le lead magnet doit :
1. Etre ecrit en francais professionnel
2. Apporter une valeur actionnable immediate
3. Etre structure en Markdown avec titres, sous-titres et listes
4. Faire entre 800 et 1500 mots
5. Inclure un titre accrocheur
6. Ne PAS etre un pitch commercial — c'est un contenu de valeur gratuit

Reponds UNIQUEMENT avec le contenu Markdown du lead magnet, en commencant par le titre (# Titre).`,
        },
      ],
    });

    const content = response.content[0];
    const markdown = content.type === 'text' ? content.text : '';

    // Extract title from first line
    const titleMatch = markdown.match(/^#\s+(.+)/m);
    const title = titleMatch ? titleMatch[1].trim() : `${typeLabel} - ${segment_name}`;

    // Save to database
    const { data: leadMagnet, error: insertError } = await supabase
      .from('lead_magnets')
      .insert({
        workspace_id: workspaceId,
        segment_key: segment_name,
        title,
        content_markdown: markdown,
        lead_magnet_type,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[LeadMagnet] Insert error:', insertError);
      return NextResponse.json({ error: 'Erreur de sauvegarde' }, { status: 500 });
    }

    return NextResponse.json({ success: true, leadMagnet });
  } catch (error) {
    console.error('[LeadMagnet] Generation error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la generation du lead magnet' },
      { status: 500 }
    );
  }
}

// GET: List lead magnets for the current workspace
export async function GET() {
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

    const { data: leadMagnets, error } = await supabase
      .from('lead_magnets')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Erreur de lecture' }, { status: 500 });
    }

    return NextResponse.json({ leadMagnets });
  } catch (error) {
    console.error('[LeadMagnet] List error:', error);
    return NextResponse.json(
      { error: 'Erreur interne' },
      { status: 500 }
    );
  }
}

// DELETE: Remove a lead magnet
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
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

    const { error } = await supabase
      .from('lead_magnets')
      .delete()
      .eq('id', id)
      .eq('workspace_id', workspaceId);

    if (error) {
      return NextResponse.json({ error: 'Erreur de suppression' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[LeadMagnet] Delete error:', error);
    return NextResponse.json(
      { error: 'Erreur interne' },
      { status: 500 }
    );
  }
}
