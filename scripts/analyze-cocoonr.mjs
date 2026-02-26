// Quick analysis of the cocoonr page structure
const res = await fetch('https://cocoonr.fr/conciergeries/', {
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
});
const html = await res.text();

// Search for JS array patterns
const patterns = [
  /var\s+concierges\s*=\s*\[/,
  /concierges\s*=\s*\[/,
  /var\s+markers\s*=\s*\[/,
  /locations\s*=\s*\[/,
];

for (const p of patterns) {
  const m = html.match(p);
  if (m) {
    const idx = m.index;
    console.log('FOUND:', p.source, 'at', idx);
    console.log(html.slice(idx, idx + 500));
    console.log('---');
  }
}

// Find coordinate patterns (French coordinates: lat 42-51, lng -5 to 10)
const coordMatch = html.match(/\[\s*4[0-9]\.\d+\s*,/g);
console.log('\nCoordinate patterns found:', coordMatch?.length || 0);
if (coordMatch) console.log('First 5:', coordMatch.slice(0, 5));

// Search for any large JS arrays
const arrayStarts = [...html.matchAll(/var\s+\w+\s*=\s*\[\s*\[/g)];
console.log('\nJS array declarations:', arrayStarts.length);
for (const m of arrayStarts) {
  console.log(`  ${m[0]} at index ${m.index}`);
  console.log(`  Preview: ${html.slice(m.index, m.index + 200)}`);
}

// Also look for inline script blocks
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
console.log(`\n${scripts.length} script blocks found`);
for (let i = 0; i < scripts.length; i++) {
  const content = scripts[i][1].trim();
  if (content.length > 100 && (content.includes('concierge') || content.includes('marker') || content.includes('LatLng'))) {
    console.log(`\nScript block ${i} (${content.length} chars):`);
    console.log(content.slice(0, 800));
    console.log('...');
  }
}
