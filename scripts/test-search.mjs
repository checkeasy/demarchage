// Test search engines to find which works
const query = '"Agency Attitude" conciergerie Sainte-Hélène-du-Lac';

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
];

// Test 1: DuckDuckGo HTML
console.log('=== TEST 1: DuckDuckGo HTML ===');
try {
  const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetch(ddgUrl, {
    headers: {
      "User-Agent": USER_AGENTS[0],
      "Accept": "text/html",
      "Accept-Language": "fr-FR,fr;q=0.9",
    },
    signal: AbortSignal.timeout(15000),
  });
  console.log('Status:', res.status);
  const html = await res.text();
  console.log('Response length:', html.length);
  console.log('Has captcha:', html.includes('captcha'));
  console.log('Has result__a:', html.includes('result__a'));

  // Extract results
  const linkRegex = /class="result__a"[^>]*href="([^"]+)"/g;
  let match;
  const results = [];
  while ((match = linkRegex.exec(html)) !== null) {
    let href = match[1];
    if (href.includes('uddg=')) {
      href = decodeURIComponent(href.split('uddg=')[1]?.split('&')[0] || '');
    }
    results.push(href);
  }
  console.log('Results found:', results.length);
  for (const r of results) console.log('  ', r);

  if (results.length === 0) {
    // Save HTML for inspection
    const fs = await import('fs');
    fs.writeFileSync('/tmp/ddg-response.html', html);
    console.log('HTML saved to /tmp/ddg-response.html');
    // Show a snippet
    console.log('HTML snippet:', html.slice(0, 2000));
  }
} catch (e) {
  console.log('Error:', e.message);
}

// Test 2: DuckDuckGo Lite
console.log('\n=== TEST 2: DuckDuckGo Lite ===');
try {
  const liteUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
  const res = await fetch(liteUrl, {
    headers: {
      "User-Agent": USER_AGENTS[0],
      "Accept": "text/html",
    },
    signal: AbortSignal.timeout(15000),
  });
  console.log('Status:', res.status);
  const html = await res.text();
  console.log('Response length:', html.length);

  // Extract links
  const linkRegex = /href="(https?:\/\/[^"]+)"/g;
  let match;
  const results = [];
  while ((match = linkRegex.exec(html)) !== null) {
    if (!match[1].includes('duckduckgo')) {
      results.push(match[1]);
    }
  }
  console.log('Links found:', results.length);
  for (const r of results.slice(0, 10)) console.log('  ', r);
} catch (e) {
  console.log('Error:', e.message);
}

// Test 3: SearXNG public instance
console.log('\n=== TEST 3: SearXNG ===');
try {
  const searxUrl = `https://search.sapti.me/search?q=${encodeURIComponent(query)}&format=json&language=fr`;
  const res = await fetch(searxUrl, {
    headers: {
      "User-Agent": USER_AGENTS[0],
      "Accept": "application/json",
    },
    signal: AbortSignal.timeout(15000),
  });
  console.log('Status:', res.status);
  if (res.ok) {
    const data = await res.json();
    console.log('Results:', data.results?.length || 0);
    for (const r of (data.results || []).slice(0, 5)) {
      console.log('  ', r.url, '-', r.title);
    }
  }
} catch (e) {
  console.log('Error:', e.message);
}

// Test 4: Direct website access
console.log('\n=== TEST 4: Direct Cocoonr detail page ===');
try {
  const url = 'https://cocoonr.fr/conciergerie/agency-attitude-29/';
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENTS[0],
      "Accept": "text/html",
    },
    signal: AbortSignal.timeout(10000),
  });
  console.log('Status:', res.status);
  const html = await res.text();

  // Find external links (not cocoonr)
  const extLinkRegex = /href="(https?:\/\/(?!cocoonr)[^"]+)"/gi;
  let match2;
  const extLinks = [];
  while ((match2 = extLinkRegex.exec(html)) !== null) {
    const href = match2[1];
    if (!href.includes('facebook') && !href.includes('instagram') && !href.includes('twitter') &&
        !href.includes('linkedin') && !href.includes('pinterest') && !href.includes('google') &&
        !href.includes('youtube') && !href.includes('apple.com') && !href.includes('play.google') &&
        !href.includes('w3.org') && !href.includes('schema.org') && !href.includes('cloudflare') &&
        !href.includes('wp-content') && !href.includes('gravatar') && !href.includes('googleapis')) {
      extLinks.push(href);
    }
  }
  console.log('External links:', extLinks.length);
  for (const l of extLinks) console.log('  ', l);

  // Find emails
  const emailMatch = html.match(/([\w.+-]+@[\w-]+\.(?:fr|com|net|org|eu|io))/gi);
  console.log('Emails found:', emailMatch || 'none');

  // Find phones
  const phoneMatch = html.match(/((?:\+33|0)[1-9](?:[\s.\-]?\d{2}){4})/g);
  console.log('Phones found:', phoneMatch || 'none');
} catch (e) {
  console.log('Error:', e.message);
}
