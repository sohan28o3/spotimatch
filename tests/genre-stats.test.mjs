import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const matchingSource = readFileSync(new URL("../src/lib/music-matching.ts", import.meta.url), "utf8");
const statsSource = readFileSync(new URL("../src/lib/genre-stats.ts", import.meta.url), "utf8")
  .replace(/import type[^;]+;\s*/g, "")
  .replace(/import \{ buildTasteVector, formatGenreTitle \}[^;]+;\s*/g, "");
const compiled = ts.transpileModule(`${matchingSource}\n${statsSource}`, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { aggregateGenreStats, topGenresForListener } = await import(
  "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
);

const spotify = artists => ({
  favorites: [],
  lastfm: null,
  spotify: {
    items: artists.map(([name, plays]) => ({ kind: "artist", name, artist: "", plays })),
    totalPlays: artists.reduce((sum, [, plays]) => sum + plays, 0),
    updatedAt: "2026-01-01T00:00:00.000Z",
    from: null,
    to: null,
    fingerprint: "test",
    fileCount: 1,
    duplicateCount: 0,
    ignoredCount: 0,
  },
});

test("each connected listener contributes to at most three genres", () => {
  const genres = topGenresForListener(spotify([["Radiohead", 50], ["Beach House", 20]]));
  assert.equal(genres.length, 3);
  assert.equal(new Set(genres).size, genres.length);
});

test("genre totals count listeners, exclude unconnected accounts, and retain connected totals", () => {
  const stats = aggregateGenreStats([
    spotify([["Radiohead", 50]]),
    spotify([["Radiohead", 20]]),
    { favorites: [{ kind: "artist", name: "Radiohead", artist: "" }], spotify: null, lastfm: null },
    { favorites: [], spotify: null, lastfm: { username: "new", connectedAt: "now", snapshot: null } },
  ]);

  assert.equal(stats.totalListeners, 3);
  assert.equal(stats.genres.find(item => item.genre === "Art Rock")?.listeners, 2);
  assert.ok(stats.genres.every(item => item.listeners <= stats.totalListeners));
});
