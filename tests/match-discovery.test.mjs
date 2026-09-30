import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const matchingSource = readFileSync(new URL("../src/lib/music-matching.ts", import.meta.url), "utf8");
const discoverySource = readFileSync(new URL("../src/lib/match-discovery.ts", import.meta.url), "utf8")
  .replace(/import type[^;]+;\s*/g, "")
  .replace(/import \{ buildTasteVector, calculateTasteMatch, formatGenreTitle \}[^;]+;\s*/g, "");
const compiled = ts.transpileModule(`${matchingSource}\n${discoverySource}`, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { buildDiscoveryCandidate, explainMatch, DAILY_MATCH_LIMIT, MIN_MATCH_SCORE } = await import(
  "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
);

const music = (artist, track = "Song") => ({
  favorites: [],
  spotify: {
    items: [{ kind: "artist", name: artist, artist: "", plays: 50 }, { kind: "track", name: track, artist, plays: 20 }],
    totalPlays: 70,
    updatedAt: "2026-01-01T00:00:00.000Z",
    from: null,
    to: null,
    fingerprint: "x",
    fileCount: 1,
    duplicateCount: 0,
    ignoredCount: 0,
  },
  lastfm: null,
});

test("daily discovery constants enforce the planned quality and size", () => {
  assert.equal(DAILY_MATCH_LIMIT, 5);
  assert.equal(MIN_MATCH_SCORE, 70);
});

test("unconnected candidates cannot enter discovery", () => {
  const result = buildDiscoveryCandidate({ id: "b", profile: { username: "b" }, callerMusic: music("Radiohead"), candidateMusic: { favorites: [], spotify: null, lastfm: null } });
  assert.equal(result, null);
});

test("same-song overlap produces a human explanation", () => {
  const explanation = explainMatch(music("Radiohead", "Nude"), music("Radiohead", "Nude"), ["Radiohead"]);
  assert.equal(explanation.matchReason, "You love the same song");
  assert.equal(explanation.matchSection, "current");
});

test("high-quality connected candidates include a frozen explanation", () => {
  const result = buildDiscoveryCandidate({ id: "b", profile: { username: "listener", displayName: "Listener" }, callerMusic: music("Radiohead"), candidateMusic: music("Radiohead") });
  assert.ok(result);
  assert.ok(result.matchScore >= 70);
  assert.ok(result.matchReason);
  assert.ok(result.matchDetail);
});
