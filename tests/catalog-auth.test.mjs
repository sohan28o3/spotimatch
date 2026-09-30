import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function moduleUrl(name, replacements = {}) {
  let code = ts.transpileModule(readFileSync(new URL('../src/lib/' + name + '.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const [specifier, url] of Object.entries(replacements)) code = code.replaceAll('"' + specifier + '"', '"' + url + '"');
  return 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
}
const musicUrl = moduleUrl('music');
const { validateItems } = await import(musicUrl);
const { normalizeItems, enrichArtwork, enrichTrackDetails, artworkCandidates } = await import(moduleUrl('catalog', { './music': musicUrl }));
const { validLastfmToken, lastfmOrigin } = await import(moduleUrl('lastfm-auth'));
const cover = 'https://cdn-images.dzcdn.net/images/cover/example/250x250.jpg';
const photo = 'https://cdn-images.dzcdn.net/images/artist/example/250x250.jpg';

test('Last.fm URL-safe tokens are accepted; missing and malformed tokens fail', () => {
  assert.equal(validLastfmToken('Example_Valid-Lastfm_Token12345'), true);
  assert.equal(validLastfmToken('1234567890abcdef1234567890abcdef'), true);
  for (const token of [null, '', 'short', 'x'.repeat(257), 'invalid token with spaces', '<script>alert(1)</script>']) assert.equal(validLastfmToken(token), false);
});
test('local callback keeps the current origin rather than switching hosts', () => {
  assert.equal(lastfmOrigin('http://localhost:3000/api/lastfm/connect', 'http://127.0.0.1:3000', true), 'http://localhost:3000');
  assert.equal(lastfmOrigin('http://127.0.0.1:3000/api/lastfm/callback', 'http://localhost:3000', true), 'http://127.0.0.1:3000');
});
test('production does not trust arbitrary callback origins', () => {
  assert.equal(lastfmOrigin('https://app.example/api/lastfm/connect', 'https://app.example', false), 'https://app.example');
  assert.throws(() => lastfmOrigin('https://evil.example/connect', 'https://app.example', false), /Open https/);
  assert.throws(() => lastfmOrigin('http://localhost:3000/connect', 'https://app.example', true), /Open https/);
});
test('normalization preserves upstream relevance order and deduplicates', () => {
  const items = normalizeItems([{ name: 'Tame Impala' }, { name: 'Tame' }, { name: 'Tame Impala' }], 'artist');
  assert.deepEqual(items.map(item => item.name), ['Tame Impala', 'Tame']);
});
test('normalization drops placeholder photos and preserves real album artwork', () => {
  const star = 'https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png';
  assert.equal(normalizeItems([{ name: 'Radiohead', image: [{ size: 'large', '#text': star }] }], 'artist')[0].image, undefined);
  const image = 'https://lastfm.freetls.fastly.net/i/u/300x300/cover.jpg';
  const item = normalizeItems([{ name: 'In Rainbows', artist: { name: 'Radiohead' }, image: [{ size: 'large', '#text': image }] }], 'album')[0];
  assert.equal(item.image, image); assert.equal(item.artist, 'Radiohead');
});
test('artwork enrichment matches identity without reordering search results', () => {
  const input = [{ kind: 'artist', name: 'Tame Impala', artist: '' }, { kind: 'artist', name: 'Tame', artist: '' }];
  const output = enrichArtwork(input, { data: [{ name: 'Tame', picture_medium: photo }, { name: 'Tame Impala', picture_medium: photo }] });
  assert.deepEqual(output.map(item => item.name), input.map(item => item.name));
  assert.equal(output[0].image, photo);
});
test('track art cannot come from a different artist with the same title', () => {
  const items = [{ kind: 'track', name: 'Nights', artist: 'Frank Ocean' }];
  const wrong = enrichArtwork(items, { data: [{ title: 'Nights', artist: { name: 'Other Artist' }, album: { title: 'Other Album', cover_medium: cover } }] });
  assert.equal(wrong[0].image, undefined);
  const right = enrichArtwork(items, { data: [{ title: 'Nights', artist: { name: 'Frank Ocean' }, album: { title: 'Blonde', cover_medium: cover }, link: 'https://www.deezer.com/track/123' }] });
  assert.equal(right[0].image, cover); assert.equal(right[0].album, 'Blonde');
  assert.equal(validateItems(right)[0].image, cover);
});
test('saved favorites strip unsafe image and link URLs', () => {
  const [item] = validateItems([{ kind: 'artist', name: 'Test', artist: '', image: 'https://evil.example/pixel', url: 'javascript:alert(1)' }]);
  assert.equal(item.image, undefined); assert.equal(item.url, undefined);
});
test('missing artwork service does not fail the main search', async () => {
  assert.equal(await artworkCandidates('artist', 'Tame', async () => { throw new Error('offline'); }), null);
  const items = [{ kind: 'artist', name: 'Tame', artist: '' }];
  assert.deepEqual(enrichArtwork(items, null), items);
});
test('empty Last.fm libraries normalize to an empty list', () => {
  assert.deepEqual(normalizeItems(undefined, 'track', true), []);
  assert.deepEqual(normalizeItems([], 'artist', true), []);
});
test('track details attach cover and album without changing relevance, even when a lookup fails', async () => {
  const items = [{ kind: 'track', name: 'Lovers Rock', artist: 'TV Girl' }, { kind: 'track', name: 'Other', artist: 'Other' }];
  const image = 'https://lastfm-img.freetls.fastly.net/i/u/300x300/example.png';
  const output = await enrichTrackDetails(items, async item => {
    if (item.name === 'Other') throw new Error('Unavailable');
    return { track: { name: 'Lovers Rock', artist: { name: 'TV Girl' }, album: { title: 'French Exit', image: [{ size: 'extralarge', '#text': image }] } } };
  });
  assert.equal(output[0].image, image); assert.equal(output[0].album, 'French Exit');
  assert.deepEqual(output[1], items[1]);
  assert.deepEqual(output.map(item => item.name), items.map(item => item.name));
});
test('track detail requests are bounded and wrong-artist responses are ignored', async () => {
  let active = 0, maximum = 0;
  const items = Array.from({ length: 12 }, (_, i) => ({ kind: 'track', name: 'Track ' + i, artist: 'Original' }));
  const output = await enrichTrackDetails(items, async item => {
    active++; maximum = Math.max(maximum, active);
    await new Promise(resolve => setTimeout(resolve, 2)); active--;
    return { track: { name: item.name, artist: { name: 'Wrong' }, album: { title: 'Wrong Album' } } };
  });
  assert.ok(maximum <= 4); assert.deepEqual(output, items);
});
