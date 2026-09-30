import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/music-matching.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const {
  buildTasteVector,
  calculateTasteMatch,
  normalizeArtistName,
  DEFAULT_CANDIDATE_MUSIC,
} = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));

test('identical music tastes produce high match score (>= 95%) and full shared artists', () => {
  const userA = {
    favorites: [
      { kind: 'artist', name: 'Radiohead', artist: '' },
      { kind: 'artist', name: 'Beach House', artist: '' },
      { kind: 'track', name: 'Weird Fishes', artist: 'Radiohead', plays: 50 },
    ],
  };
  const userB = {
    favorites: [
      { kind: 'artist', name: 'Radiohead', artist: '' },
      { kind: 'artist', name: 'Beach House', artist: '' },
      { kind: 'track', name: 'Weird Fishes', artist: 'Radiohead', plays: 60 },
    ],
  };

  const match = calculateTasteMatch(userA, userB);
  assert.ok(match.matchScore >= 95, `Expected score >= 95, got ${match.matchScore}`);
  assert.equal(match.sharedArtists.length, 2);
  assert.ok(match.sharedArtists.includes('Radiohead'));
  assert.ok(match.sharedArtists.includes('Beach House'));
  assert.ok(match.rawArtistCosine >= 0.95);
});

test('disjoint tastes produce low baseline score (~48-50%) and empty shared artists', () => {
  const rockFan = {
    favorites: [
      { kind: 'artist', name: 'Nirvana', artist: '' },
      { kind: 'artist', name: 'Foo Fighters', artist: '' },
      { kind: 'artist', name: 'Green Day', artist: '' },
    ],
  };
  const trapFan = {
    favorites: [
      { kind: 'artist', name: '21 Savage', artist: '' },
      { kind: 'artist', name: 'Metro Boomin', artist: '' },
      { kind: 'artist', name: 'Playboi Carti', artist: '' },
    ],
  };

  const match = calculateTasteMatch(rockFan, trapFan);
  assert.ok(match.matchScore <= 52, `Expected score <= 52, got ${match.matchScore}`);
  assert.equal(match.sharedArtists.length, 0);
  assert.equal(match.rawArtistCosine, 0);
});

test('logarithmic damping prevents single 1,000-play artist from drowning out broader taste', () => {
  // User A has 1,000 plays on Radiohead, 20 on Beach House
  const userA = {
    spotify: {
      totalPlays: 1020,
      items: [
        { kind: 'artist', name: 'Radiohead', artist: '', plays: 1000 },
        { kind: 'artist', name: 'Beach House', artist: '', plays: 20 },
      ],
    },
  };
  // User B has 30 plays on Radiohead, 30 on Beach House
  const userB = {
    spotify: {
      totalPlays: 60,
      items: [
        { kind: 'artist', name: 'Radiohead', artist: '', plays: 30 },
        { kind: 'artist', name: 'Beach House', artist: '', plays: 30 },
      ],
    },
  };

  const match = calculateTasteMatch(userA, userB);
  // Without log damping, 1,000 plays would dominate and distort cosine; with log damping:
  // log2(1000) ~ 9.96, log2(30) ~ 4.9. Both artists remain balanced and match is very high.
  assert.ok(match.matchScore >= 90, `Expected score >= 90 with log damping, got ${match.matchScore}`);
  assert.equal(match.sharedArtists.length, 2);
});

test('genre/tag bridge elevates users with different artists in the same subgenre', () => {
  // User A listens to Beach House and Cocteau Twins (Dream pop / Shoegaze)
  const userA = {
    favorites: [
      { kind: 'artist', name: 'Beach House', artist: '' },
      { kind: 'artist', name: 'Cocteau Twins', artist: '' },
    ],
  };
  // User B listens to Slowdive and Cigarettes After Sex (Dream pop / Shoegaze)
  const userB = {
    favorites: [
      { kind: 'artist', name: 'Slowdive', artist: '' },
      { kind: 'artist', name: 'Cigarettes After Sex', artist: '' },
    ],
  };

  const match = calculateTasteMatch(userA, userB);
  // 0 direct shared artists
  assert.equal(match.sharedArtists.length, 0);
  assert.equal(match.rawArtistCosine, 0);
  // But heavy genre tag overlap in Dream Pop & Shoegaze
  assert.ok(match.rawGenreCosine > 0.6, `Expected genre cosine > 0.6, got ${match.rawGenreCosine}`);
  assert.ok(match.matchScore >= 62, `Expected vibe bridge boost >= 62, got ${match.matchScore}`);
  assert.ok(
    match.vibe.toLowerCase().includes('dream pop') || match.vibe.toLowerCase().includes('shoegaze')
  );
});

test('cold start with no music returns graceful 50% baseline without throwing', () => {
  const match = calculateTasteMatch(null, null);
  assert.equal(match.matchScore, 50);
  assert.equal(match.sharedArtists.length, 0);

  const matchOneSided = calculateTasteMatch({ favorites: [] }, DEFAULT_CANDIDATE_MUSIC['user-maya']);
  assert.equal(matchOneSided.matchScore, 50);
});

test('candidate Maya Chen dynamically matches high with Radiohead & Beach House listeners', () => {
  const indieListener = {
    favorites: [
      { kind: 'artist', name: 'Radiohead', artist: '' },
      { kind: 'artist', name: 'Beach House', artist: '' },
      { kind: 'artist', name: 'Frank Ocean', artist: '' },
    ],
  };

  const mayaMatch = calculateTasteMatch(indieListener, DEFAULT_CANDIDATE_MUSIC['user-maya']);
  assert.ok(mayaMatch.matchScore >= 92, `Expected Maya match >= 92, got ${mayaMatch.matchScore}`);
  assert.ok(mayaMatch.sharedArtists.includes('Radiohead'));
  assert.ok(mayaMatch.sharedArtists.includes('Beach House'));
  assert.ok(mayaMatch.sharedArtists.includes('Frank Ocean'));

  // Conversely, hip-hop only listener should match low with Maya Chen
  const hiphopListener = {
    favorites: [
      { kind: 'artist', name: 'Eminem', artist: '' },
      { kind: 'artist', name: 'Kendrick Lamar', artist: '' },
    ],
  };
  const hiphopMaya = calculateTasteMatch(hiphopListener, DEFAULT_CANDIDATE_MUSIC['user-maya']);
  assert.ok(hiphopMaya.matchScore <= 55, `Expected Maya match <= 55 for hiphop listener, got ${hiphopMaya.matchScore}`);
});
