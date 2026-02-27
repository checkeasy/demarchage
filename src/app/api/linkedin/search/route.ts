// =============================================================================
// POST /api/linkedin/search
// Recherche de profils LinkedIn avec filtres
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getLinkedInClientForWorkspace } from '@/lib/linkedin/client';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { LinkedInError, LinkedInErrorType } from '@/lib/linkedin/types';
import type { LinkedInSearchParams } from '@/lib/linkedin/types';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
    }

    const body = await request.json();
    const {
      keywords,
      title,
      jobTitle,
      location,
      industry,
      company,
      companySize,
      school,
      network,
      connectionOf,
      start,
      count,
    } = body;

    const searchParams: LinkedInSearchParams = {
      keywords,
      title: title || jobTitle, // SearchForm envoie "jobTitle"
      location,
      industry,
      company,
      companySize: companySize ? (Array.isArray(companySize) ? companySize : [companySize]) : undefined,
      school,
      network,
      connectionOf,
      start: start ?? 0,
      count: count ?? 25,
    };

    // Resolve workspace for DB-stored LinkedIn cookies
    let workspaceId = body.workspace_id as string | undefined;
    if (!workspaceId) {
      const admin = createAdminClient();
      const { data: ws } = await admin.from('workspaces').select('id').limit(1).single();
      workspaceId = ws?.id;
    }

    const client = await getLinkedInClientForWorkspace(workspaceId || '');
    const results = await client.searchPeople(searchParams);

    // Mapper les résultats au format attendu par le frontend
    const profiles = results.results.map((r, index) => ({
      id: r.publicIdentifier || String(index + 1),
      fullName: `${r.firstName} ${r.lastName}`.trim(),
      firstName: r.firstName,
      lastName: r.lastName,
      jobTitle: r.currentTitle || r.headline || '',
      company: r.currentCompany || '',
      location: r.location || '',
      headline: r.headline || '',
      profileUrl: r.profileUrl,
      profilePictureUrl: r.profilePictureUrl || null,
      relevanceScore: 0,
      industry: '',
      companySize: '',
      connectionDegree: r.connectionDegree || '',
      summary: '',
    }));

    return NextResponse.json({
      profiles,
      pagination: {
        total: results.total,
        start: results.start,
        count: results.count,
        hasMore: results.hasMore,
      },
    });
  } catch (err) {
    console.error('[API LinkedIn Search] Erreur:', err);

    if (err instanceof LinkedInError) {
      const status =
        err.errorType === LinkedInErrorType.SESSION_EXPIRED
          ? 401
          : err.errorType === LinkedInErrorType.RATE_LIMITED
            ? 429
            : err.errorType === LinkedInErrorType.FORBIDDEN
              ? 403
              : 500;

      return NextResponse.json(
        {
          error: err.message,
          code: err.errorType,
        },
        { status }
      );
    }

    return NextResponse.json(
      { error: 'Erreur interne lors de la recherche LinkedIn' },
      { status: 500 }
    );
  }
}
