import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routes = [
  "src/app/api/account/route.ts",
  "src/app/api/catalog/route.ts",
  "src/app/api/chat/route.ts",
  "src/app/api/chat/dm/route.ts",
  "src/app/api/friends/route.ts",
  "src/app/api/notifications/route.ts",
];

test("identity-sensitive routes require verified users and reject client identity fallbacks", async () => {
  for (const path of routes) {
    const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
    assert.match(source, /requireUser\(request\)/, `${path} must verify the Firebase token`);
    assert.doesNotMatch(source, /callerUid|queryUid|uid\s*=\s*["']preview["']/, `${path} must not trust a client identity`);
  }
});

test("preview-mode persistence and entry points are absent from the application shell", async () => {
  const source = await readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /spotimatch_preview_v1|startPreview|Explore Preview|setPreview/);
});

test("profile reads authenticate before applying server-side visibility", async () => {
  const source = await readFile(
    new URL("../src/app/api/account/route.ts", import.meta.url),
    "utf8"
  );
  assert.match(source, /const viewer = await requireUser\(request\)/);
  assert.match(source, /const canView = \(visibility: VisibilityLevel\)/);
  assert.match(source, /canView\(showTopSongs\)/);
  assert.match(source, /canView\(showTopArtists\)/);
  assert.match(source, /canView\(showNowPlaying\)/);
  assert.match(source, /targetBlocks\.has\(viewer\.uid\)/);
});

test("direct messages require a server-verified friendship and block check", async () => {
  const source = await readFile(
    new URL("../src/app/api/chat/dm/route.ts", import.meta.url),
    "utf8"
  );
  assert.match(source, /requireDirectMessageAccess\(uid, friendId\)/);
  assert.match(source, /friends\.some\(friend => friend\.id === friendId\)/);
  assert.match(source, /theirBlocks\.has\(uid\)/);
});

test("administrator operations require the verified email allowlist on the server", async () => {
  const [serverSource, adminRoute, pageSource] = await Promise.all([
    readFile(new URL("../src/lib/server.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/admin/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(serverSource, /ADMIN_EMAIL\s*=\s*["']sohanmutra28@gmail\.com["']/);
  assert.match(serverSource, /user\.email_verified/);
  assert.match(adminRoute, /requireAdmin\(request\)/);
  assert.doesNotMatch(adminRoute, /requireUser\(request\)/);
  assert.match(pageSource, /user\?\.emailVerified/);
});
