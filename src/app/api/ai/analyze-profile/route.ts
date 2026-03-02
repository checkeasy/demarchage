import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  analyzeProfileForOutreach,
  type ProspectProfile,
} from '@/lib/ai/message-generator';
import {
  analyzeWebsite,
  type WebsiteAnalysis,
} from '@/lib/scraper/website-analyzer';

interface AnalyzeProfileRequest {
  profile: ProspectProfile;
  websiteUrl?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Non autorise' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: AnalyzeProfileRequest = await request.json();
    const { profile, websiteUrl } = body;

    if (!profile) {
      return NextResponse.json(
        { error: 'Le champ "profile" est requis' },
        { status: 400 }
      );
    }

    // Run profile analysis
    const profileAnalysis = await analyzeProfileForOutreach(profile);

    // Optionally run website analysis
    let websiteAnalysis: WebsiteAnalysis | null = null;
    const urlToAnalyze =
      websiteUrl || (profile.website as string) || null;

    if (urlToAnalyze) {
      try {
        websiteAnalysis = await analyzeWebsite(urlToAnalyze);
      } catch (error) {
        console.error(
          `Erreur lors de l'analyse du site ${urlToAnalyze}:`,
          error
        );
        // Continue without website data - not a blocking error
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        profileAnalysis,
        websiteAnalysis,
      },
      analyzedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Erreur analyse de profil:', error);

    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'Cle API Anthropic invalide ou manquante' },
          { status: 500 }
        );
      }
      if (error.message.includes('rate limit') || error.message.includes('429')) {
        return NextResponse.json(
          { error: 'Limite de requetes Anthropic atteinte. Veuillez reessayer dans quelques instants.' },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Erreur interne du serveur lors de l\'analyse du profil' },
      { status: 500 }
    );
  }
}
