import { NextRequest, NextResponse } from 'next/server';
import { findEmailsForDomain } from '@/lib/scraper/email-finder';
import { findOwner } from '@/lib/scraper/owner-finder';
import type { GoogleMapsBusinessResult } from '@/lib/scraper/google-maps-scraper';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
    }

    const { business } = (await request.json()) as {
      business: GoogleMapsBusinessResult;
    };

    if (!business || !business.businessName) {
      return NextResponse.json(
        { error: 'Donnees business requises' },
        { status: 400 }
      );
    }

    let emails = null;
    let ownerResult = null;

    // Step 1: Find emails from website (reuse existing email-finder)
    if (business.website) {
      try {
        emails = await findEmailsForDomain(
          business.website,
          business.businessName
        );
      } catch (err) {
        console.error('[enrich-maps] Email finder error:', err);
      }
    }

    // Step 2: Find owner name (via website + AI)
    if (business.website) {
      try {
        ownerResult = await findOwner(business.website, business.businessName);
      } catch (err) {
        console.error('[enrich-maps] Owner finder error:', err);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        business,
        emails: emails?.emails || [],
        ownerFirstName: ownerResult?.ownerFirstName || null,
        ownerLastName: ownerResult?.ownerLastName || null,
        ownerRole: ownerResult?.ownerRole || null,
        ownerConfidence: ownerResult?.confidence || 0,
        ownerLinkedInUrl: ownerResult?.linkedinUrl || null,
        enrichedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[API enrich-maps-business] Error:', err);
    return NextResponse.json(
      { error: 'Erreur interne lors de l\'enrichissement' },
      { status: 500 }
    );
  }
}
