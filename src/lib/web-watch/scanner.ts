import * as cheerio from "cheerio";
import { getAnthropic, CLAUDE_HAIKU, extractTextContent } from "@/lib/ai/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendDailyRecap } from "@/lib/web-watch/daily-recap";

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  published_at?: string;
}

interface WatchResult {
  title: string;
  url: string | null;
  snippet: string;
  source: string;
  relevance_score: number;
  prospect_id: string | null;
  published_at: string | null;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const FETCH_TIMEOUT = 10000;
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
};

// ─── Web Search via DuckDuckGo ──────────────────────────────────────────────

async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });

    if (!response.ok) return [];

    const html = await response.text();
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];

    $(".result").each((_, el) => {
      const titleEl = $(el).find(".result__a");
      const snippetEl = $(el).find(".result__snippet");
      const href = titleEl.attr("href") || "";

      let actualUrl = href;
      const uddgMatch = href.match(/uddg=([^&]+)/);
      if (uddgMatch) {
        actualUrl = decodeURIComponent(uddgMatch[1]);
      }

      if (actualUrl && actualUrl.startsWith("http")) {
        results.push({
          title: titleEl.text().trim(),
          url: actualUrl,
          snippet: snippetEl.text().trim(),
        });
      }
    });

    return results.slice(0, 8);
  } catch (error) {
    console.error("[WebWatch] DuckDuckGo search error:", error);
    return [];
  }
}

// ─── Google News RSS ────────────────────────────────────────────────────────

async function searchGoogleNews(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=fr&gl=FR&ceid=FR:fr`;
    const response = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });

    if (!response.ok) return [];

    const xml = await response.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    const results: SearchResult[] = [];

    $("item").each((_, el) => {
      const title = $(el).find("title").text().trim();
      const link = $(el).find("link").text().trim();
      const description = $(el).find("description").text().trim();
      const pubDate = $(el).find("pubDate").text().trim();

      // Strip HTML from description
      const snippet = description.replace(/<[^>]+>/g, "").trim();

      // Parse pubDate to ISO string
      let published_at: string | undefined;
      if (pubDate) {
        const parsed = new Date(pubDate);
        if (!isNaN(parsed.getTime())) {
          published_at = parsed.toISOString();
        }
      }

      if (title && link) {
        results.push({ title, url: link, snippet, published_at });
      }
    });

    return results.slice(0, 8);
  } catch (error) {
    console.error("[WebWatch] Google News error:", error);
    return [];
  }
}

// ─── AI Summarizer ──────────────────────────────────────────────────────────

async function summarizeResults(
  topic: string,
  results: SearchResult[]
): Promise<{
  summary: string;
  scored: { index: number; relevance: number; key_insight: string }[];
}> {
  if (results.length === 0) {
    return { summary: "Aucun resultat trouve.", scored: [] };
  }

  const anthropic = getAnthropic();
  const resultsList = results
    .map(
      (r, i) =>
        `[${i}] ${r.title}\n${r.snippet}\nURL: ${r.url}`
    )
    .join("\n\n");

  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_HAIKU,
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `Tu es un analyste de veille concurrentielle pour une entreprise SaaS qui vend des logiciels aux conciergeries et gestionnaires de locations saisonnieres en France.

Sujet de veille: "${topic}"

Resultats web trouves:
${resultsList}

Analyse ces resultats et reponds en JSON strict:
{
  "summary": "Resume en 2-3 phrases des informations cles trouvees aujourd'hui",
  "scored": [
    {"index": 0, "relevance": 85, "key_insight": "Phrase cle expliquant pourquoi c'est pertinent"}
  ]
}

Criteres de pertinence (0-100):
- 80-100: Directement lie a nos prospects ou notre marche
- 50-79: Interessant pour le contexte marche
- 0-49: Peu pertinent

Ne garde que les resultats avec relevance >= 40.`,
        },
      ],
    });

    const text = extractTextContent(response);
    // Strip markdown code fences before parsing
    const cleaned = text.replace(/```(?:json)?\s*/g, "").replace(/```/g, "");
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    console.warn("[WebWatch] AI returned non-JSON response:", text.slice(0, 200));
  } catch (error) {
    console.error("[WebWatch] AI summary error:", (error as Error).message || error);
  }

  return {
    summary: `${results.length} resultats trouves pour "${topic}"`,
    scored: results.map((_, i) => ({
      index: i,
      relevance: 50,
      key_insight: results[i].title,
    })),
  };
}

// ─── Match with prospects ───────────────────────────────────────────────────

function matchProspects(
  text: string,
  prospectMap: Map<string, string> // company name lowercase → prospect_id
): string | null {
  const lower = text.toLowerCase();
  for (const [company, id] of prospectMap) {
    if (company.length >= 4 && lower.includes(company)) {
      return id;
    }
  }
  return null;
}

// ─── Main Scanner ───────────────────────────────────────────────────────────

export async function runWebWatchScan(workspaceId: string, userId: string) {
  const supabase = createAdminClient();

  // 1. Get active watches
  const { data: watches } = await supabase
    .from("web_watches")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true);

  if (!watches || watches.length === 0) {
    return { scanned: 0, results: 0, message: "Aucun sujet de veille actif" };
  }

  // 2. Build prospect lookup map
  const { data: prospects } = await supabase
    .from("prospects")
    .select("id, company, organization")
    .eq("workspace_id", workspaceId)
    .limit(5000);

  const prospectMap = new Map<string, string>();
  for (const p of prospects || []) {
    const prospect = p as { id: string; company: string | null; organization: string | null };
    const company = (prospect.organization || prospect.company || "").toLowerCase().trim();
    if (company && company.length >= 4) {
      prospectMap.set(company, prospect.id);
    }
  }

  // 3. Scan each watch topic
  let totalResults = 0;
  const errors: string[] = [];

  for (const watch of watches) {
    const w = watch as { id: string; topic: string; keywords: string[] };
    const searchQueries = w.keywords.length > 0
      ? w.keywords
      : [w.topic];

    const allSearchResults: SearchResult[] = [];

    // Search DuckDuckGo + Google News for each query
    for (const query of searchQueries) {
      const [ddgResults, newsResults] = await Promise.all([
        searchDuckDuckGo(`${query} site:fr OR france 2026`),
        searchGoogleNews(query),
      ]);
      allSearchResults.push(...ddgResults, ...newsResults);
    }

    // Deduplicate by URL
    const seen = new Set<string>();
    const unique = allSearchResults.filter((r) => {
      if (seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });

    if (unique.length === 0) continue;

    // AI scoring and summary
    const { scored } = await summarizeResults(w.topic, unique);

    // Build results to insert
    const watchResults: WatchResult[] = [];
    for (const s of scored) {
      const result = unique[s.index];
      if (!result) continue;

      const fullText = `${result.title} ${result.snippet}`;
      const prospectId = matchProspects(fullText, prospectMap);

      watchResults.push({
        title: result.title,
        url: result.url,
        snippet: s.key_insight || result.snippet,
        source: result.url.includes("news.google") ? "google_news" : "duckduckgo",
        relevance_score: s.relevance,
        prospect_id: prospectId,
        published_at: result.published_at || null,
      });
    }

    // Check for existing results (avoid duplicates from same day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: existingToday } = await supabase
      .from("web_watch_results")
      .select("url")
      .eq("watch_id", w.id)
      .gte("detected_at", today.toISOString());

    const existingUrls = new Set((existingToday || []).map((r: { url: string }) => r.url));

    const toInsert = watchResults
      .filter((r) => !r.url || !existingUrls.has(r.url))
      .map((r) => ({
        workspace_id: workspaceId,
        watch_id: w.id,
        ...r,
      }));

    if (toInsert.length > 0) {
      const { error } = await supabase.from("web_watch_results").insert(toInsert);
      if (error) {
        errors.push(`Watch "${w.topic}": ${error.message}`);
      } else {
        totalResults += toInsert.length;
      }
    }

    // Auto-create signals for matched prospects
    for (const r of toInsert) {
      if (r.prospect_id) {
        const { error: signalError } = await supabase.from("prospect_signals").insert({
          workspace_id: workspaceId,
          prospect_id: r.prospect_id,
          signal_type: "content_engagement",
          signal_source: "web_scrape",
          title: `Mentionne dans l'actualite: ${r.title.slice(0, 80)}`,
          description: r.snippet?.slice(0, 200) || null,
          signal_score: Math.min(Math.round(r.relevance_score / 3), 30),
          created_by: userId,
        });

        // Mark signal_created on the web_watch_result
        if (!signalError && r.url) {
          await supabase
            .from("web_watch_results")
            .update({ signal_created: true })
            .eq("watch_id", r.watch_id)
            .eq("url", r.url);
        }
      }
    }

    // Update last_run_at
    await supabase
      .from("web_watches")
      .update({ last_run_at: new Date().toISOString() })
      .eq("id", w.id);
  }

  // Send daily recap after scan completes
  try {
    const recapResult = await sendDailyRecap(workspaceId);
    console.log(`[WebWatch] Recap sent: ${recapResult.sent}, results: ${recapResult.resultsCount}`);
  } catch (recapErr) {
    console.error("[WebWatch] Recap error:", recapErr);
  }

  return {
    scanned: watches.length,
    results: totalResults,
    errors: errors.length > 0 ? errors : undefined,
  };
}
