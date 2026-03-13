import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAnthropic, CLAUDE_HAIKU, extractTextContent } from '@/lib/ai/client';
import * as cheerio from 'cheerio';

const FETCH_TIMEOUT = 8000;
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
};

async function searchDuckDuckGo(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    if (!response.ok) return [];
    const html = await response.text();
    const $ = cheerio.load(html);
    const results: { title: string; url: string; snippet: string }[] = [];
    $('.result').each((_, el) => {
      const title = $(el).find('.result__title').text().trim();
      const href = $(el).find('.result__url').attr('href') || $(el).find('.result__a').attr('href') || '';
      const snippet = $(el).find('.result__snippet').text().trim();
      if (title && href) results.push({ title, url: href, snippet });
    });
    return results.slice(0, 8);
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
    }

    const { email, company } = await request.json();

    if (!email && !company) {
      return NextResponse.json({ error: 'Email ou entreprise requis' }, { status: 400 });
    }

    // Build search queries
    const queries: string[] = [];
    let domain = '';

    if (email) {
      // Extract domain from email
      const parts = email.split('@');
      if (parts.length === 2 && !parts[1].match(/gmail|yahoo|hotmail|outlook|icloud|protonmail|live|msn/i)) {
        domain = parts[1];
        queries.push(`"${domain}" conciergerie OR location OR immobilier OR gestion locative`);
        queries.push(`site:linkedin.com "${domain}"`);
      }
      queries.push(`"${email}"`);
    }

    if (company) {
      queries.push(`"${company}" conciergerie OR location OR immobilier OR gestion locative`);
      if (!email) {
        queries.push(`site:linkedin.com "${company}"`);
      }
    }

    // Run searches in parallel
    const searchResults = await Promise.all(queries.map(q => searchDuckDuckGo(q)));
    const allResults = searchResults.flat();

    // Try to fetch the company website if we have a domain
    let websiteContent = '';
    if (domain) {
      try {
        const res = await fetch(`https://${domain}`, {
          headers: HEADERS,
          signal: AbortSignal.timeout(FETCH_TIMEOUT),
        });
        if (res.ok) {
          const html = await res.text();
          const $ = cheerio.load(html);
          $('script, style, nav, footer, header').remove();
          websiteContent = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 2000);
        }
      } catch {
        // ignore
      }
    }

    // Use AI to extract structured info
    const searchContext = allResults
      .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.snippet}`)
      .join('\n\n');

    const prompt = `A partir des informations suivantes, extrais les donnees d'un prospect B2B.

Email fourni: ${email || 'Non fourni'}
Entreprise fournie: ${company || 'Non fournie'}
Domaine: ${domain || 'Non disponible'}

Resultats de recherche web:
${searchContext || 'Aucun resultat'}

${websiteContent ? `Contenu du site web (${domain}):\n${websiteContent}` : ''}

Extrais UNIQUEMENT les informations que tu peux deduire avec confiance. Laisse vide ("") si tu n'es pas sur.

Reponds UNIQUEMENT en JSON valide:
{
  "first_name": "",
  "last_name": "",
  "company": "",
  "job_title": "",
  "phone": "",
  "linkedin_url": "",
  "website": "",
  "location": "",
  "city": "",
  "industry": "",
  "employee_count": ""
}

Pour industry, utilise une de ces valeurs si applicable: conciergerie, gestionnaire_locatif, proprietaire_bailleur, location_vacances, agence_immo, hotel, villa_rental, gite, chateau_domaine, residence, chalet, chambre_hote, camping, gestion_locative, maison_vacances
Pour employee_count: 1-10, 11-50, 51-200, 201-500, 500+`;

    const response = await getAnthropic().messages.create({
      model: CLAUDE_HAIKU,
      max_tokens: 500,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = extractTextContent(response);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Impossible d\'extraire les informations' }, { status: 500 });
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // If we have a domain and no website was returned, use the domain
    if (!parsed.website && domain) {
      parsed.website = `https://${domain}`;
    }

    return NextResponse.json({ success: true, data: parsed });
  } catch (err) {
    console.error('[API Autofill]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur interne' },
      { status: 500 }
    );
  }
}
