import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  scrapeWebsite,
  analyzeWebsite,
} from '@/lib/scraper/website-analyzer';

interface ScrapeWebsiteRequest {
  url: string;
  analyze?: boolean; // If true, also run AI analysis (default: true)
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
    const body: ScrapeWebsiteRequest = await request.json();
    const { url, analyze = true } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'Le champ "url" est requis' },
        { status: 400 }
      );
    }

    // Basic URL validation
    let normalizedUrl = url.trim();
    if (
      !normalizedUrl.startsWith('http://') &&
      !normalizedUrl.startsWith('https://')
    ) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    try {
      new URL(normalizedUrl);
    } catch {
      return NextResponse.json(
        { error: 'URL invalide. Veuillez fournir une URL valide (ex: https://example.com)' },
        { status: 400 }
      );
    }

    if (analyze) {
      // Full analysis: scrape + AI
      const analysis = await analyzeWebsite(normalizedUrl);
      return NextResponse.json({
        success: true,
        data: analysis,
        analyzedAt: new Date().toISOString(),
      });
    } else {
      // Scrape only, no AI analysis
      const scrapedData = await scrapeWebsite(normalizedUrl);
      return NextResponse.json({
        success: true,
        data: { scrapedData },
        scrapedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('Erreur scraping website:', error);

    if (error instanceof Error) {
      // Handle timeout errors
      if (error.message.includes('Timeout')) {
        return NextResponse.json(
          { error: error.message },
          { status: 504 }
        );
      }

      // Handle fetch errors
      if (error.message.includes('HTTP')) {
        return NextResponse.json(
          { error: `Erreur lors de l'acces au site: ${error.message}` },
          { status: 502 }
        );
      }

      // Handle OpenAI errors
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'Cle API OpenAI invalide ou manquante' },
          { status: 500 }
        );
      }

      if (error.message.includes('rate limit') || error.message.includes('429')) {
        return NextResponse.json(
          { error: 'Limite de requetes OpenAI atteinte. Veuillez reessayer dans quelques instants.' },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Erreur interne du serveur lors de l\'analyse du site web' },
      { status: 500 }
    );
  }
}
