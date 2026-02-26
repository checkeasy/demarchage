import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
    }

    // Get user's current workspace
    const { data: profile } = await supabase
      .from('profiles')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single();

    const workspaceId = profile?.current_workspace_id;

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Aucun workspace actif' },
        { status: 400 }
      );
    }

    // Bulk add
    if (body.bulk && Array.isArray(body.bulk)) {
      const inserts = body.bulk.map(
        (b: {
          email?: string;
          businessName?: string;
          ownerFirstName?: string;
          ownerLastName?: string;
          ownerRole?: string;
          phone?: string;
          website?: string;
          address?: string;
          googleMapsUrl?: string;
          rating?: number;
          reviewCount?: number;
          category?: string;
        }) => ({
          workspace_id: workspaceId,
          email: b.email || '',
          first_name: b.ownerFirstName || null,
          last_name: b.ownerLastName || null,
          company: b.businessName || '',
          job_title: b.ownerRole || 'Gerant',
          phone: b.phone || null,
          linkedin_url: null,
          website: b.website || null,
          location: b.address || null,
          source: 'google_maps' as const,
          status: 'active' as const,
          custom_fields: {
            google_maps_url: b.googleMapsUrl || '',
            rating: b.rating || null,
            review_count: b.reviewCount || null,
            category: b.category || '',
          },
        })
      );

      const { error } = await supabase.from('prospects').insert(inserts);
      if (error) {
        console.error('[API add-maps-prospects] Bulk error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, count: inserts.length });
    }

    // Single add
    const { error } = await supabase.from('prospects').insert({
      workspace_id: workspaceId,
      email: body.email || '',
      first_name: body.ownerFirstName || null,
      last_name: body.ownerLastName || null,
      company: body.businessName || '',
      job_title: body.ownerRole || 'Gerant',
      phone: body.phone || null,
      linkedin_url: null,
      website: body.website || null,
      location: body.address || null,
      source: 'google_maps' as const,
      status: 'active' as const,
      custom_fields: {
        google_maps_url: body.googleMapsUrl || '',
        rating: body.rating || null,
        review_count: body.reviewCount || null,
        category: body.category || '',
      },
    });

    if (error) {
      console.error('[API add-maps-prospects] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[API add-maps-prospects] Fatal error:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
