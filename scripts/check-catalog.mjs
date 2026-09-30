// Optional live check: public music search only; never prints credentials.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import ts from 'typescript';
process.loadEnvFile('.env.local');
if (!process.env.LASTFM_API_KEY) throw new Error('Set LASTFM_API_KEY first.');
function compile(name, replacements = {}) {
  let code = ts.transpileModule(readFileSync('src/lib/' + name + '.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const [specifier, replacement] of Object.entries(replacements)) code = code.replaceAll('"' + specifier + '"', '"' + replacement + '"');
  return 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
}
const { normalizeItems, enrichArtwork, enrichTrackDetails, artworkCandidates } = await import(compile('catalog', { './music': compile('music') }));
const examples = [];
for (const [kind, query] of [['artist', 'Kanye'], ['track', 'lovers rock'], ['album', 'The new abnormal']]) {
  const params = new URLSearchParams({ method: kind + '.search', [kind]: query, api_key: process.env.LASTFM_API_KEY, format: 'json', limit: '12' });
  const [response, artwork] = await Promise.all([
    fetch('https://ws.audioscrobbler.com/2.0/?' + params, { signal: AbortSignal.timeout(15000) }).then(r => r.json()),
    kind === 'artist' ? artworkCandidates(kind, query) : Promise.resolve(null),
  ]);
  if (response.error) throw new Error('Last.fm returned error code ' + response.error);
  let items = enrichArtwork(normalizeItems(response.results?.[kind + 'matches']?.[kind], kind), artwork);
  if (kind === 'track') items = await enrichTrackDetails(items, item => {
    const parameters = new URLSearchParams({ method: 'track.getInfo', artist: item.artist, track: item.name, api_key: process.env.LASTFM_API_KEY, format: 'json' });
    return fetch('https://ws.audioscrobbler.com/2.0/?' + parameters, { signal: AbortSignal.timeout(3000) }).then(r => r.json());
  });
  examples.push({ kind, query, items });
  console.log(JSON.stringify({ kind, results: items.length, withArtwork: items.filter(item => item.image).length, firstResults: items.slice(0, 3).map(item => ({ name: item.name, artist: item.artist, hasArtwork: Boolean(item.image), album: item.album })) }));
}
mkdirSync('artifacts', { recursive: true });
writeFileSync('artifacts/catalog-smoke.json', JSON.stringify(examples, null, 2));
