import { NextRequest, NextResponse } from 'next/server';
import { searchGoogleMaps } from '@/lib/scraper/google-maps-scraper';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
    }

    const body = await request.json();
    const { query, location, maxResults = 20 } = body as {
      query: string;
      location?: string;
      maxResults?: number;
    };

    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return NextResponse.json(
        { error: 'Le champ "query" est requis (minimum 2 caracteres)' },
        { status: 400 }
      );
    }

    const result = await searchGoogleMaps(query.trim(), location?.trim());

    // Limit results but preserve the original total count
    const originalTotal = result.totalFound;
    result.businesses = result.businesses.slice(0, Math.min(maxResults, 20));
    result.totalFound = originalTotal;

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error('[API search-maps] Error:', err);
    return NextResponse.json(
      { error: 'Erreur interne lors de la recherche Google Maps' },
      { status: 500 }
    );
  }
}
