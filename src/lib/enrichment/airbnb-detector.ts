import * as cheerio from "cheerio";

const FETCH_TIMEOUT = 10000;
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
};

export interface AirbnbResult {
  airbnb_url: string;
  nb_properties?: number;
  snippet?: string;
}

/**
 * Search DuckDuckGo for Airbnb host profile
 */
export async function findAirbnbProfile(
  companyName: string,
  city?: string
): Promise<AirbnbResult | null> {
  try {
    const query = city
      ? `"${companyName}" ${city} site:airbnb.fr OR site:airbnb.com`
      : `"${companyName}" site:airbnb.fr OR site:airbnb.com`;

    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });

    if (!response.ok) return null;

    const html = await response.text();
    const $ = cheerio.load(html);

    // Look for Airbnb URLs in results
    let bestUrl: string | null = null;
    let bestSnippet = "";

    $(".result").each((_, el) => {
      const href = $(el).find(".result__a").attr("href") || "";
      const snippet = $(el).find(".result__snippet").text().trim();

      let actualUrl = href;
      const uddgMatch = href.match(/uddg=([^&]+)/);
      if (uddgMatch) {
        actualUrl = decodeURIComponent(uddgMatch[1]);
      }

      // Match Airbnb host/user pages
      if (
        actualUrl.includes("airbnb.fr/users/") ||
        actualUrl.includes("airbnb.com/users/") ||
        actualUrl.includes("airbnb.fr/s/") ||
        actualUrl.includes("airbnb.com/s/")
      ) {
        if (!bestUrl) {
          bestUrl = actualUrl;
          bestSnippet = snippet;
        }
      }
    });

    if (!bestUrl) return null;

    // Try to extract number of properties from snippet
    let nbProperties: number | undefined;
    const propMatch = bestSnippet.match(/(\d+)\s*(?:logement|annonce|bien|listing)/i);
    if (propMatch) {
      nbProperties = parseInt(propMatch[1]);
    }

    return {
      airbnb_url: bestUrl,
      nb_properties: nbProperties,
      snippet: bestSnippet.slice(0, 200),
    };
  } catch (err) {
    console.error(`[AirbnbDetector] Error for "${companyName}":`, err);
    return null;
  }
}
