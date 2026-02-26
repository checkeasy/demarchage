import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = createAdminClient();

    // Get the first workspace (outil interne = single workspace)
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('id')
      .limit(1)
      .single();

    if (!workspace) {
      return NextResponse.json(
        { error: 'Aucun workspace trouve. Creez-en un d\'abord.' },
        { status: 400 }
      );
    }

    function generateEmail(firstName: string, lastName: string, linkedinUrl: string): string {
      // Extract public ID from LinkedIn URL as unique identifier
      const match = linkedinUrl?.match(/\/in\/([^/?]+)/);
      const slug = match ? match[1] : `${firstName}.${lastName}`.toLowerCase().replace(/\s+/g, '');
      return `${slug}@linkedin-prospect.local`;
    }

    // Bulk add
    if (body.bulk && Array.isArray(body.bulk)) {
      const inserts = body.bulk.map((p: Record<string, string | number>) => ({
        email: generateEmail(String(p.first_name || ''), String(p.last_name || ''), String(p.linkedin_url || '')),
        first_name: p.first_name || '',
        last_name: p.last_name || '',
        company: p.company || '',
        job_title: p.job_title || '',
        linkedin_url: p.linkedin_url || '',
        location: p.location || '',
        source: 'linkedin',
        status: 'active',
        workspace_id: workspace.id,
        custom_fields: {
          headline: p.headline || '',
          relevance_score: p.relevance_score || 0,
          industry: p.industry || '',
          company_size: p.company_size || '',
        },
      }));

      const { error } = await supabase.from('prospects').insert(inserts);

      if (error) {
        console.error('[API Prospects Add] Bulk error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, count: inserts.length });
    }

    // Single add
    const { error } = await supabase.from('prospects').insert({
      email: generateEmail(body.first_name || '', body.last_name || '', body.linkedin_url || ''),
      first_name: body.first_name || '',
      last_name: body.last_name || '',
      company: body.company || '',
      job_title: body.job_title || '',
      linkedin_url: body.linkedin_url || '',
      location: body.location || '',
      source: 'linkedin',
      status: 'active',
      workspace_id: workspace.id,
      custom_fields: {
        headline: body.headline || '',
        relevance_score: body.relevance_score || 0,
        industry: body.industry || '',
        company_size: body.company_size || '',
      },
    });

    if (error) {
      console.error('[API Prospects Add] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[API Prospects Add] Error:', err);
    return NextResponse.json(
      { error: 'Erreur interne' },
      { status: 500 }
    );
  }
}
