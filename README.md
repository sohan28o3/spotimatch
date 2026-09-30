# SpotiMatch

SpotiMatch helps people find music friends through real listening history. It is a responsive Next.js app with Google sign-in, taste-based discovery, friend requests, direct and global chat, notifications, and monthly Sound Capsules.

## First-time user flow

1. Continue with Google from the signed-out landing page.
2. Create the required public profile.
3. Review all three music setup methods in order: favorites, Last.fm, and Spotify history. Each music method may be skipped, but the walkthrough itself cannot be bypassed.
4. Connect Last.fm or import Spotify listening history to unlock the app. Favorites alone do not provide enough listening data for discovery.

If both listening sources are later removed, the app returns to the setup gate. If only one is missing, Home shows the relevant setup guide. The user’s own Home profile privately shows which sources are connected.

## Listening data

- Last.fm supplies current listening, current-month scrobbles, artists, tracks, and a strongest monthly genre when enough genre data exists.
- Spotify Extended Streaming History supplies completed monthly listening minutes and historical summaries.
- Sound Capsule never invents missing months or genres. Unknown genre data appears as `Not enough genre data`.
- Production discovery, chats, listener totals, and genre totals use registered-user data only. Demo people, seeded conversations, simulated replies, and inflated online counts are not used.

## Help and administration

The in-app Help page explains setup, matches, requests, chat, capsules, and data removal. The admin dashboard is available only to the configured admin email in `src/lib/server.ts`. Its switches pause Discovery, friend requests, or Global Chat for all users, with a clear unavailable state in the affected UI.

## Local development

Run `npm install`, then `npm run dev`. Firebase credentials are required for sign-in and authenticated features. See [SETUP.md](SETUP.md) for Firebase, Last.fm, environment variables, Firestore rules, hosting, and integration checks.

Before sharing a build, run:

```bash
npm run lint
npm test
npm run build
```
