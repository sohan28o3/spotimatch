# Public testing readiness audit

Date: 30 September 2026

## Outcome

The public-test path now uses a separate signed-out landing page, a mandatory four-screen onboarding sequence, and a listening-data gate. Production social and statistics surfaces no longer generate fake users, seeded chats, automated replies, invented online users, or demo Sound Capsule months.

## User-flow checks

| Area | Expected behavior | Verification |
| --- | --- | --- |
| Signed out | Branding, short description, and Continue with Google only | Visually checked in a Chromium browser at laptop width |
| Profile setup | Required before music setup | Routing condition and profile-save flow checked; automated username tests pass |
| Music setup | Favorites, Last.fm, and Spotify screens are all visited in sequence | Component flow inspected and production build type-checked |
| No listening data | Main app stays locked with a clear Last.fm/Spotify setup choice | Application gate checked in source and production build |
| Returning setup | Missing-source guidance returns after a source is removed | Home derives guidance directly from current account sources |
| Own profile | Connected Last.fm and Spotify state is visible privately | Home profile source badges added |
| Discovery | Real connected users only; disabled state follows admin switch | API and UI guards checked; matching tests pass |
| Friend requests | Real requests with one optional message; disabled state follows admin switch | Server and UI guards checked |
| Chats | No seeded messages, simulated replies, or inflated online count | Production fallback paths removed |
| Sound Capsule | Spotify minutes, Last.fm current-month scrobbles, strongest known genre, no fake months | Parser and rendering paths checked; import tests pass |
| Help | Setup and core feature guidance available without crowding main pages | Help route and navigation checked in source/build |
| Admin | Configured email only; Discovery, requests, and Global Chat switches enforced server-side | Authentication and admin tests pass |

## Automated verification

- `npm test`: 44/44 passing.
- `npm run lint`: exits successfully with 0 errors; 99 existing warnings remain.
- `npm run build`: successful Next.js 16.3.6 production build, including TypeScript and route generation.

## Test boundary

Google-authenticated multi-user behavior was not exercised end-to-end in multiple live browser accounts during this pass. Doing that safely requires test Google accounts and the configured Firebase project. Before inviting public testers, run a short two-account smoke test covering request/accept, direct messaging, blocking, visibility settings, and admin feature switches.

