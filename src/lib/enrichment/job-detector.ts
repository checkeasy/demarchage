import * as cheerio from "cheerio";

const FETCH_TIMEOUT = 10000;
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
};

const JOB_KEYWORDS = [
  "gestionnaire locatif",
  "assistant conciergerie",
  "responsable locations",
  "property manager",
  "charge de gestion locative",
  "hote accueil voyageurs",
];

export interface JobPosting {
  title: string;
  url: string;
  source: string;
  snippet?: string;
}

/**
 * Search DuckDuckGo for job postings by a company.
 */
export async function findJobPostings(
  companyName: string,
  keywords?: string[]
): Promise<JobPosting[]> {
  const searchKeywords = keywords || JOB_KEYWORDS;
  const keywordStr = searchKeywords.slice(0, 3).map((k) => `"${k}"`).join(" OR ");
  const query = `"${companyName}" recrutement OR emploi OR embauche ${keywordStr} site:indeed.fr OR site:linkedin.com OR site:welcometothejungle.com`;

  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });

    if (!response.ok) return [];

    const html = await response.text();
    const $ = cheerio.load(html);
    const results: JobPosting[] = [];

    $(".result").each((_, el) => {
      const titleEl = $(el).find(".result__a");
      const snippetEl = $(el).find(".result__snippet");
      const href = titleEl.attr("href") || "";
      const title = titleEl.text().trim();
      const snippet = snippetEl.text().trim();

      let actualUrl = href;
      const uddgMatch = href.match(/uddg=([^&]+)/);
      if (uddgMatch) {
        actualUrl = decodeURIComponent(uddgMatch[1]);
      }

      // Only keep job-related results
      const isJobSite =
        actualUrl.includes("indeed.") ||
        actualUrl.includes("linkedin.com/jobs") ||
        actualUrl.includes("welcometothejungle.") ||
        actualUrl.includes("pole-emploi.") ||
        actualUrl.includes("hellowork.");

      const hasJobKeywords =
        /recrutement|emploi|embauche|poste|recrut|job|offre/i.test(title + " " + snippet);

      if (actualUrl.startsWith("http") && (isJobSite || hasJobKeywords)) {
        let source = "web";
        if (actualUrl.includes("indeed.")) source = "indeed";
        else if (actualUrl.includes("linkedin.")) source = "linkedin";
        else if (actualUrl.includes("welcometothejungle.")) source = "wttj";

        results.push({
          title,
          url: actualUrl,
          source,
          snippet: snippet.slice(0, 200),
        });
      }
    });

    return results.slice(0, 5);
  } catch (err) {
    console.error(`[JobDetector] Error for "${companyName}":`, err);
    return [];
  }
}
