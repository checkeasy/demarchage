import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { findExistingProspect, mergeProspectData } from '@/lib/utils/prospect-matcher';
import { PROTECTED_STATUSES } from '@/lib/utils/contactability';

export async function POST(request: NextRequest) {
  try {
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
      const match = linkedinUrl?.match(/\/in\/([^/?]+)/);
      const slug = match ? match[1] : `${firstName}.${lastName}`.toLowerCase().replace(/\s+/g, '');
      return `${slug}@linkedin-prospect.local`;
    }

    const missionId = body.mission_id || (body.bulk?.[0]?.mission_id);

    // Bulk add with upsert
    if (body.bulk && Array.isArray(body.bulk)) {
      let inserted = 0;
      let updated = 0;
      let errors = 0;

      for (const p of body.bulk) {
        const prospectData: Record<string, unknown> = {
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
          industry: p.industry || null,
          employee_count: p.company_size || null,
          city: p.location ? String(p.location).split(',')[0].trim() : null,
          mission_id: missionId || null,
          custom_fields: {
            headline: p.headline || '',
            relevance_score: p.relevance_score || 0,
          },
        };

        // Try to find existing prospect
        const existingId = await findExistingProspect(supabase, workspace.id, {
          email: prospectData.email as string,
          linkedin_url: p.linkedin_url || '',
          organization: p.company || '',
          first_name: p.first_name || '',
          last_name: p.last_name || '',
        });

        if (existingId) {
          // Fetch existing and merge
          const { data: existing } = await supabase
            .from('prospects')
            .select('*')
            .eq('id', existingId)
            .single();

          if (existing) {
            // Protect status from being overwritten on protected prospects
            if ((PROTECTED_STATUSES as readonly string[]).includes(existing.status)) {
              delete prospectData.status;
            }
            const merged = mergeProspectData(existing, prospectData);
            const { error } = await supabase
              .from('prospects')
              .update(merged)
              .eq('id', existingId);

            if (error) { errors++; } else { updated++; }
          }
        } else {
          const { error } = await supabase.from('prospects').insert(prospectData);
          if (error) { errors++; } else { inserted++; }
        }
      }

      // Auto-enroll in mission if mission_id provided
      if (missionId && inserted > 0) {
        try {
          const { enrollProspectInMission } = await import('@/lib/missions/enroll-prospect');
          const { data: mission } = await supabase
            .from('outreach_missions')
            .select('id, campaign_email_id, campaign_linkedin_id, campaign_multichannel_id')
            .eq('id', missionId)
            .single();

          if (mission) {
            const { data: newProspects } = await supabase
              .from('prospects')
              .select('id, email, linkedin_url, phone, status')
              .eq('workspace_id', workspace.id)
              .eq('mission_id', missionId)
              .order('created_at', { ascending: false })
              .limit(inserted);

            if (newProspects) {
              for (const p of newProspects) {
                await enrollProspectInMission(supabase, mission, p);
              }
            }

            const { count: missionProspectCount } = await supabase
              .from('prospects')
              .select('id', { count: 'exact', head: true })
              .eq('mission_id', missionId);

            await supabase
              .from('outreach_missions')
              .update({ total_prospects: missionProspectCount || 0 })
              .eq('id', missionId);
          }
        } catch (err) {
          console.error('[API Prospects Add] Mission enrollment error:', err);
        }
      }

      return NextResponse.json({ success: true, inserted, updated, errors });
    }

    // Single add with upsert
    const prospectData: Record<string, unknown> = {
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
      industry: body.industry || null,
      employee_count: body.company_size || null,
      city: body.location ? String(body.location).split(',')[0].trim() : null,
      mission_id: missionId || null,
      custom_fields: {
        headline: body.headline || '',
        relevance_score: body.relevance_score || 0,
      },
    };

    const existingId = await findExistingProspect(supabase, workspace.id, {
      email: prospectData.email as string,
      linkedin_url: body.linkedin_url || '',
      organization: body.company || '',
      first_name: body.first_name || '',
      last_name: body.last_name || '',
    });

    if (existingId) {
      const { data: existing } = await supabase
        .from('prospects')
        .select('*')
        .eq('id', existingId)
        .single();

      if (existing) {
        // Protect status from being overwritten on protected prospects
        if ((PROTECTED_STATUSES as readonly string[]).includes(existing.status)) {
          delete prospectData.status;
        }
        const merged = mergeProspectData(existing, prospectData);
        const { error } = await supabase
          .from('prospects')
          .update(merged)
          .eq('id', existingId);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, action: 'updated', id: existingId });
      }
    }

    const { error } = await supabase.from('prospects').insert(prospectData);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Auto-enroll in mission if mission_id provided (single add)
    if (missionId) {
      try {
        const { enrollProspectInMission } = await import('@/lib/missions/enroll-prospect');
        const { data: mission } = await supabase
          .from('outreach_missions')
          .select('id, campaign_email_id, campaign_linkedin_id, campaign_multichannel_id')
          .eq('id', missionId)
          .single();

        if (mission) {
          const { data: newProspect } = await supabase
            .from('prospects')
            .select('id, email, linkedin_url, phone, status')
            .eq('workspace_id', workspace.id)
            .eq('mission_id', missionId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (newProspect) {
            await enrollProspectInMission(supabase, mission, newProspect);
          }

          const { count: missionProspectCount } = await supabase
            .from('prospects')
            .select('id', { count: 'exact', head: true })
            .eq('mission_id', missionId);

          await supabase
            .from('outreach_missions')
            .update({ total_prospects: missionProspectCount || 0 })
            .eq('id', missionId);
        }
      } catch (err) {
        console.error('[API Prospects Add] Mission enrollment error:', err);
      }
    }

    return NextResponse.json({ success: true, action: 'inserted' });
  } catch (err) {
    console.error('[API Prospects Add] Error:', err);
    return NextResponse.json(
      { error: 'Erreur interne' },
      { status: 500 }
    );
  }
}
