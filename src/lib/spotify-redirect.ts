/**
 * Smart Spotify Redirection Utility
 * Attempts to launch the native Spotify Desktop or Mobile app first.
 * If the app is not installed or doesn't open within 1.5 seconds,
 * it automatically continues to the Spotify Web player.
 */
export function openSpotifyTrack(
  trackName: string,
  artistName?: string,
  explicitUrl?: string
) {
  if (typeof window === "undefined") return;

  const cleanTrack = (trackName || "Track").trim();
  const cleanArtist = (artistName || "").trim();
  const query = encodeURIComponent(`${cleanTrack} ${cleanArtist}`.trim());

  // Web fallback URL
  const webUrl =
    explicitUrl && explicitUrl.includes("spotify.com")
      ? explicitUrl
    : `https://open.spotify.com/search/${query}`;

  // Native Spotify app URI scheme
  const trackIdMatch = explicitUrl?.match(/track\/([a-zA-Z0-9]+)/);
  const appUri = trackIdMatch
    ? `spotify:track:${trackIdMatch[1]}`
    : `spotify:search:${query}`;

  // Create a clean helper window to handle protocol attempt and web fallback
  const helperWindow = window.open("", "_blank");
  if (helperWindow) {
    const escapedTrack = cleanTrack.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    const escapedArtist = cleanArtist.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

    helperWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Opening ${escapedTrack} on Spotify...</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      background: #121212;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      text-align: center;
      user-select: none;
    }
    .card {
      background: #181818;
      border: 1px solid rgba(255, 255, 255, 0.08);
      padding: 36px 32px;
      border-radius: 24px;
      max-width: 440px;
      width: 100%;
      box-shadow: 0 24px 48px rgba(0, 0, 0, 0.7);
    }
    .icon {
      width: 52px;
      height: 52px;
      background: #1db954;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
      color: #000000;
      box-shadow: 0 8px 24px rgba(29, 185, 84, 0.35);
    }
    .spinner {
      width: 28px;
      height: 28px;
      border: 3px solid rgba(29, 185, 84, 0.2);
      border-top-color: #1db954;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    h1 {
      font-size: 20px;
      font-weight: 800;
      margin: 0 0 8px 0;
      color: #ffffff;
      letter-spacing: -0.02em;
    }
    .subtitle {
      font-size: 13px;
      color: #1ed760;
      font-weight: 600;
      margin: 0 0 16px 0;
    }
    p {
      font-size: 13px;
      color: #b3b3b3;
      line-height: 1.5;
      margin: 0 0 24px 0;
    }
    .btn {
      display: inline-block;
      background: #1db954;
      color: #000000;
      font-weight: 800;
      font-size: 13px;
      text-decoration: none;
      padding: 12px 30px;
      border-radius: 500px;
      transition: all 0.2s ease;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(29, 185, 84, 0.4);
    }
    .btn:hover {
      background: #1ed760;
      transform: scale(1.04);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <h1>Launching Spotify...</h1>
    <div class="subtitle">${escapedTrack}${escapedArtist ? " • " + escapedArtist : ""}</div>
    <p>Opening this track in your Spotify desktop or mobile app. If the app is not installed, you'll be redirected to the web player.</p>
    <a id="web-btn" class="btn" href="${webUrl}">Open on Web Player</a>
  </div>
  <script>
    // 1. Trigger the native Spotify protocol URI
    try {
      window.location.href = "${appUri}";
    } catch (e) {}

    // 2. Automatically redirect to Spotify Web after 1.6s if app did not take over
    var redirectTimer = setTimeout(function() {
      window.location.replace("${webUrl}");
    }, 1600);

    // If user clicks the web button manually, cancel timer and proceed
    document.getElementById("web-btn").addEventListener("click", function() {
      clearTimeout(redirectTimer);
    });
  <\/script>
</body>
</html>`);
    helperWindow.document.close();
  } else {
    // Popup was blocked by browser configuration; direct navigate to appUri
    window.location.href = appUri;
  }
}

/**
 * Launch artist discography on Spotify app first, falling back to web player.
 */
export function openSpotifyArtist(artistName: string) {
  if (typeof window === "undefined") return;

  const cleanArtist = (artistName || "Artist").trim();
  const query = encodeURIComponent(cleanArtist);
  const webUrl = `https://open.spotify.com/search/${query}`;
  const appUri = `spotify:search:${query}`;

  const helperWindow = window.open("", "_blank");
  if (helperWindow) {
    const escapedArtist = cleanArtist
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");

    helperWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Opening ${escapedArtist} on Spotify...</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      background: #121212;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      text-align: center;
      user-select: none;
    }
    .card {
      background: #181818;
      border: 1px solid rgba(255, 255, 255, 0.08);
      padding: 36px 32px;
      border-radius: 24px;
      max-width: 440px;
      width: 100%;
      box-shadow: 0 24px 48px rgba(0, 0, 0, 0.7);
    }
    .spinner {
      width: 28px;
      height: 28px;
      border: 3px solid rgba(29, 185, 84, 0.2);
      border-top-color: #1db954;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    h1 {
      font-size: 20px;
      font-weight: 800;
      margin: 0 0 8px 0;
      color: #ffffff;
      letter-spacing: -0.02em;
    }
    .subtitle {
      font-size: 13px;
      color: #1ed760;
      font-weight: 600;
      margin: 0 0 16px 0;
    }
    p {
      font-size: 13px;
      color: #b3b3b3;
      line-height: 1.5;
      margin: 0 0 24px 0;
    }
    .btn {
      display: inline-block;
      background: #1db954;
      color: #000000;
      font-weight: 800;
      font-size: 13px;
      text-decoration: none;
      padding: 12px 30px;
      border-radius: 500px;
      transition: all 0.2s ease;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(29, 185, 84, 0.4);
    }
    .btn:hover {
      background: #1ed760;
      transform: scale(1.04);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <h1>Opening in Spotify...</h1>
    <div class="subtitle">${escapedArtist}</div>
    <p>Launching ${escapedArtist}'s discography in your Spotify desktop or mobile app. If not installed, you'll be redirected to the web player.</p>
    <a id="web-btn" class="btn" href="${webUrl}">Open on Web Player</a>
  </div>
  <script>
    try {
      window.location.href = "${appUri}";
    } catch (e) {}

    var redirectTimer = setTimeout(function() {
      window.location.replace("${webUrl}");
    }, 1600);

    document.getElementById("web-btn").addEventListener("click", function() {
      clearTimeout(redirectTimer);
    });
  <\/script>
</body>
</html>`);
    helperWindow.document.close();
  } else {
    window.location.href = appUri;
  }
}
