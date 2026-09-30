# Spotimatch setup

## Run the app locally

Configure Firebase and the environment variables below, then run `npm install` and `npm run dev`. Open http://localhost:3000 and sign in with Google. Server-backed features do not accept unauthenticated or client-supplied user identities.

## 1. Firebase (Spark / no billing required)

1. Create a project at https://console.firebase.google.com/ and keep the Spark plan.
2. Register a Web app and copy its API key, auth domain, project ID and app ID into `.env.local` using `.env.example`.
3. In Authentication → Sign-in method, enable **Google** and choose a support email.
4. In Authentication → Settings → Authorized domains, add `localhost` and your deployed domain.
5. Create a Cloud Firestore database in production mode. Choose the appropriate region for your audience.
6. Copy `firestore.rules` into Firestore → Rules and publish them. Browser access is intentionally denied; all app data passes through authenticated server routes.
7. In Project settings → Service accounts, generate a private key. Set `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` locally and in your hosting environment. For `.env.local`, use a quoted private key with escaped newlines, e.g. `FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"`.

Do not commit or paste service-account files or private keys into chat. The API verifies Firebase Google ID tokens, then uses the Admin SDK to enforce account ownership. Admin credentials bypass Firestore rules, so all mutations are validated server-side. No Firebase Storage, Cloud Functions, or billing-enabled products are used.

## 2. Last.fm

1. Create a Last.fm account, then apply for an API application at https://www.last.fm/api/account/create.
2. Set the application callback to `http://localhost:3000/api/lastfm/callback` for local development or `https://YOUR-DOMAIN/api/lastfm/callback` for deployment.
3. Set `LASTFM_API_KEY` and `LASTFM_SHARED_SECRET` in `.env.local` and the hosting environment.
4. Set `APP_URL` to the exact origin of the app. A custom callback adds a one-time state parameter; the stored browser cookie and Firestore pending request bind it to the signed-in user.
5. Restart the app after editing environment variables. Test Connect Last.fm and authorize your application.

Only read-only public music methods are used after ownership authorization. The Last.fm session key is discarded, not stored. Music summaries contain all-time top 50 artists, tracks and albums, not the full raw scrobble log. Empty histories are supported. Explicit refresh is limited to once every five minutes; returning to a completed profile refreshes a snapshot older than 24 hours. There is no background polling while a user is away. Disconnect deletes the saved connection and Last.fm summary. Users can separately revoke the authorization in Last.fm settings.

Search uses Last.fm's artist/track/album catalog. Manual entry remains available if the API is not configured or unavailable. Follow Last.fm's API terms; commercial use requires contacting Last.fm.

## 3. Free hosting

This is a standard Next.js app with Node server routes. Use Vercel Hobby for an eligible personal noncommercial project, or Netlify Free subject to its usage allowance. A static export will not support the API routes.

1. Put the project in a private Git repository (this directory was not a Git repository when implementation began).
2. Import it into your hosting provider; use the Next.js preset and `npm run build`.
3. Add all `.env.example` variables in the hosting dashboard. Set `APP_URL` to the stable production origin.
4. Add that domain to Firebase Auth and update the Last.fm callback. Keep callbacks on a stable domain, not changing preview deployment URLs.
5. Redeploy after changing public Firebase variables; Next.js embeds these at build time.
6. Test real Google sign-in, saving a profile, a username conflict in a second account, Last.fm authorization/cancellation/refresh/disconnect, and imports on the deployed domain before inviting testers.

Do not enable Firebase billing just to use this app. Free hosting and Firestore still have quotas; monitor usage. An abandoned Last.fm authorization leaves a small expired record in `lastfmPending`; expired records can be manually removed periodically (no paid TTL feature is required).

## Data model and behavior

- `users/{uid}`: username, display name, bio, Google avatar URL or initials preference, persistent onboarding step, timestamps. Email remains in Firebase Auth.
- `usernames/{username}`: transactionally reserved unique handle. Renaming releases the old handle in the same transaction.
- `music/{uid}`: manual favorites, separate Spotify import summary and Last.fm summary.
- `connections/{uid}`: verified Last.fm username and connection timestamp, server-only.
- `lastfmPending/{randomState}`: one-use, ten-minute authorization request.
- `rateLimits/{uid_action}`: per-account search/connect/sync limits across server instances.

Onboarding always presents favorites → Last.fm → Spotify history. Every music step is skippable; users can finish with no music. The dashboard supports revisiting each source and editing their profile. Data is private to its owner in this phase; matching and public discovery are not implemented.

Spotify import supports standard `StreamingHistory*.json` and extended `Streaming_History_Audio*.json`. Extract ZIPs first. Select up to 30 JSON files and 50 MB combined. Records lasting under 30 seconds, podcasts, and malformed rows are excluded. Matching time/title/artist/duration records are deduplicated (timestamps normalized to minutes for compatibility with standard exports). Only aggregate top-50 lists, coverage, counts and a fingerprint leave the browser; no raw history or IP/device information is uploaded.

Each new Spotify import **replaces** the previous Spotify summary. Include all old and new history files together to preserve coverage. Importing the same data again does not add plays. Last.fm and Spotify remain separate: counts are never added across sources, so overlapping periods do not inflate a combined total. Manual favorites are not presented as measured listening. Imported files are user-supplied data, not proof of Spotify account ownership.

## Checks

- `npm run lint`
- `npm test` (Spotify format handling, deduplication, privacy stripping, limits and validation)
- `npm run build` (includes TypeScript checks)

Real authentication and provider calls need your configured accounts. No credentials are bundled.

## Callback troubleshooting and search artwork

Last.fm authorization works before Spotify is connected and with an empty listening history. Callback tokens are opaque URL-safe strings (including hyphens and underscores). In local development the app keeps callbacks on the same localhost/127.0.0.1 origin where authorization started. Use that origin consistently and authorize both local hostnames in Firebase if you switch between them. In production APP_URL must match the browser origin. Restart development after changing next.config.ts.

The callback saves the connection atomically and returns immediately. The page then refreshes listening data without blocking onboarding. Error notices appear above the step, and server diagnostics log only a failure category, never credentials. Browser-extension-added HTML attributes such as crxlauncher can cause hydration warnings; test with that extension disabled for localhost to isolate them.

Search keeps Last.fm relevance order and shows ranked rows with artist names, track/album titles, and artwork when available. Artist photos are enriched from Deezer's public catalog using exact name matches. Track cover art and album titles come from Last.fm track details with a 24-hour server cache and bounded concurrency. Missing or failed artwork uses a neutral icon; it never removes or reorders a result. Artwork URLs are allowlisted, and saved favorites retain their artwork. Search ranking is Last.fm's, not Spotify's proprietary ranking. No additional API key is required for artwork.

Optional live smoke check: `node scripts/check-catalog.mjs` runs three public catalog searches using your local Last.fm key and prints result counts without revealing credentials.
