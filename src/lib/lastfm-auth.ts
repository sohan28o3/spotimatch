// Last.fm tokens are opaque; URL-safe punctuation is valid.
export function validLastfmToken(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{16,256}$/.test(token);
}

export function lastfmOrigin(requestUrl: string, configured: string | undefined, development: boolean): string {
  if (!configured) throw new Error("Set APP_URL before connecting Last.fm.");
  const requested = new URL(requestUrl), canonical = new URL(configured);
  const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
  if (development && loopback.has(requested.hostname) && loopback.has(canonical.hostname) && ["http:", "https:"].includes(requested.protocol)) {
    return requested.origin;
  }
  if (requested.origin !== canonical.origin) throw new Error(`Open ${canonical.origin} and connect Last.fm there so your sign-in stays on the same site.`);
  return canonical.origin;
}
