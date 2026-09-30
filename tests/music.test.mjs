import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/music.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { parseSpotifyFiles, validateItems, validateImport } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const extended = (overrides = {}) => ({ ts: '2025-06-01T12:00:00Z', ms_played: 200000, master_metadata_track_name: 'Reckoner', master_metadata_album_artist_name: 'Radiohead', master_metadata_album_album_name: 'In Rainbows', ip_addr: 'private', username: 'private', ...overrides });
const file = (rows, name = 'Streaming_History_Audio.json') => ({ name, text: JSON.stringify(rows) });

test('extended history produces artists, tracks, albums and strips private data', async () => {
  const result = await parseSpotifyFiles([file([extended(), extended({ ts: '2025-06-02T12:00:00Z' })])]);
  assert.equal(result.totalPlays, 2); assert.equal(result.items.length, 3);
  assert.equal(result.items.find(i => i.kind === 'album').plays, 2);
  assert.equal(JSON.stringify(result).includes('private'), false);
  assert.equal(validateImport(result).totalPlays, 2);
});
test('basic history is supported without inventing albums', async () => {
  const result = await parseSpotifyFiles([file([{ endTime: '2025-06-01 12:00', msPlayed: 200000, trackName: 'Reckoner', artistName: 'Radiohead' }])]);
  assert.equal(result.totalPlays, 1); assert.equal(result.items.length, 2);
  assert.equal(result.from, '2025-06-01T12:00:00.000Z');
});
test('duplicate files and overlapping records do not inflate counts', async () => {
  const result = await parseSpotifyFiles([file([extended()]), file([extended(), extended({ ts: '2025-06-02T12:00:00Z' })])]);
  assert.equal(result.totalPlays, 2); assert.equal(result.duplicateCount, 1);
});
test('fingerprint is independent of file order and duplicated records', async () => {
  const a = file([extended()]), b = file([extended({ ts: '2025-06-02T12:00:00Z' })]);
  assert.equal((await parseSpotifyFiles([a, b])).fingerprint, (await parseSpotifyFiles([b, a, a])).fingerprint);
});
test('mixed basic and extended exports keep album data regardless of file order', async () => {
  const basic = file([{ endTime: '2025-06-01 12:00', msPlayed: 200000, trackName: 'Reckoner', artistName: 'Radiohead' }]);
  const richer = file([extended()]);
  for (const files of [[basic, richer], [richer, basic]]) {
    const result = await parseSpotifyFiles(files);
    assert.equal(result.totalPlays, 1); assert.equal(result.duplicateCount, 1);
    assert.equal(result.items.find(item => item.kind === 'album').plays, 1);
  }
});
test('UTF-8 BOM in exported JSON is accepted', async () => {
  const result = await parseSpotifyFiles([{ name: 'history.json', text: '\uFEFF' + JSON.stringify([extended()]) }]);
  assert.equal(result.totalPlays, 1);
});
test('podcasts, short plays, malformed dates and unknown rows are excluded', async () => {
  const result = await parseSpotifyFiles([file([extended(), extended({ ms_played: 1000 }), extended({ master_metadata_track_name: null }), extended({ ts: 'broken' }), { irrelevant: true }])]);
  assert.equal(result.totalPlays, 1); assert.equal(result.ignoredCount, 4);
});
test('invalid JSON, empty files and unrelated account exports fail clearly', async () => {
  await assert.rejects(parseSpotifyFiles([{ name: 'bad.json', text: '{' }]), /valid JSON/);
  await assert.rejects(parseSpotifyFiles([file([])]), /No music plays/);
  await assert.rejects(parseSpotifyFiles([file([{ username: 'a' }])]), /no Spotify/);
  await assert.rejects(parseSpotifyFiles([]), /between 1 and 30/);
});
test('summaries cap each category at 50 items', async () => {
  const result = await parseSpotifyFiles([file(Array.from({ length: 80 }, (_, i) => extended({ master_metadata_track_name: 'Track ' + i, master_metadata_album_artist_name: 'Artist ' + i, master_metadata_album_album_name: 'Album ' + i })))]);
  assert.equal(result.items.length, 150); assert.equal(result.totalPlays, 80);
});
test('favorite validation normalizes duplicates and strips arbitrary fields', () => {
  const result = validateItems([{ kind: 'artist', name: 'Radiohead', artist: '', secret: 'no' }, { kind: 'artist', name: ' radiohead ', artist: '' }]);
  assert.equal(result.length, 1); assert.equal('secret' in result[0], false);
  assert.throws(() => validateItems([{ kind: 'track', name: 'Track', artist: '' }]), /title and artist/);
  assert.throws(() => validateItems(Array(101).fill({})), /at most 100/);
});
test('summary validation rejects corrupted counts, dates and fingerprints', async () => {
  const valid = await parseSpotifyFiles([file([extended()])]);
  assert.throws(() => validateImport({ ...valid, totalPlays: -1 }), /counts/);
  assert.throws(() => validateImport({ ...valid, fingerprint: 'bad' }), /fingerprint/);
  assert.throws(() => validateImport({ ...valid, from: 'invalid' }), /date/);
  assert.throws(() => validateImport({ ...valid, items: [{ kind: 'artist', name: 'Artist', artist: '', plays: NaN }] }), /play count/);
});
