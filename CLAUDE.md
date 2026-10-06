# Party Jukebox (musicplayer)

YouTube jukebox: one computer plays music (the **player**), guests control it from their phones (the **remote**). Hosted on Vercel, state in Upstash Redis.

- GitHub: https://github.com/jaz4Aung/musicplayer (remote `musicplayer`, branch `main`). Owner: jaz4Aung.
- `origin` still points to the old repo `whatcoffee-bakery/jukebox`. Don't push there.
- Local folder: `~/Desktop/musicplayer` (renamed from `~/Desktop/jukebox`).

## Files

| Path | What it does |
|---|---|
| `player.html` | Desktop page. "Start the jukebox" button, YouTube IFrame player (controls hidden), QR code to `/remote`, up-next list. Polls `/api/player` every 3s, reports position, gets state back. Skips videos that error (embedding disabled). |
| `remote.html` | Phone page. Now playing + progress bar, play/pause, skip, volume, search or paste link, add / play next, queue (move to next, remove, clear), "your name". Polls `/api/state` every 3s, stops while the tab is hidden. |
| `index.html` | Landing page linking to both. |
| `common.js`, `style.css` | Shared helpers (`api()`, `el()` DOM builder, PIN prompt, toast) and dark theme. |
| `api/state.js` | GET: state + player status + `pinRequired` + `searchEnabled`. No PIN needed. |
| `api/command.js` | POST actions: add, remove, bump, skip (ignores stale `currentId`), pause, play, volume, clear. Looks up titles for pasted links via YouTube oEmbed. |
| `api/player.js` | POST from the player: `ended`/`error` events advance the queue (only if the item is current), status saved with 15s TTL ("player offline" after that). |
| `api/search.js` | YouTube Data API search (embeddable videos only), cached 1h. 501 if no key. |
| `lib/store.js` | Redis access. State is one JSON key `jukebox:state` updated under a short lock key. Falls back to an in-memory store when there are no Redis env vars and not on Vercel. |
| `lib/http.js` | PIN check (`x-jukebox-pin` header), link parsing, helpers. |
| `dev.js` | `npm run dev`: local server on :3000 with the in-memory store. |
| `test/api.test.js` | `npm test`: API tests (node:test), mocks `fetch`. |

## Environment variables (Vercel)

- `KV_REST_API_URL`, `KV_REST_API_TOKEN`: added by the Upstash integration (`UPSTASH_REDIS_REST_*` also accepted).
- `JUKEBOX_PIN` (optional): required for any control action and for the player. Viewing doesn't need it.
- `YOUTUBE_API_KEY` (optional): enables search. Free quota is about 100 searches/day.
- Env var changes only apply after a redeploy.

## Conventions

- Plain HTML/JS, no framework, no build step. ES modules (`"type": "module"`).
- Build page content with `el()` / `textContent`, never `innerHTML` (song titles come from users).
- Run `npm test` before committing. Add tests for new API behavior.
- Keep Upstash usage low: one read per remote poll, two commands per player poll.

## Progress log

- 2026-10-06: Got the repo from whatcoffee-bakery/jukebox (only README/package.json/vercel.json). Pushed it to jaz4Aung/musicplayer, set git user.name to jaz4Aung.
- 2026-10-06: Built the whole app (commit d34488d). 11 API tests pass. Pages checked with jsdom against the local server. Not yet checked: real YouTube playback and the visual look in a browser.
- 2026-10-06: User connected Upstash Redis in Vercel. Gave steps to redeploy, add `JUKEBOX_PIN` and add `YOUTUBE_API_KEY` (not yet confirmed done or tested live).

## Next steps / ideas

- Confirm the live deploy works: `/api/state` returns JSON, player plays, phone shows "Player connected".
- Possible features: lock viewing behind the PIN too, max songs per person, recently played / previous song, vote to skip, YouTube playlist links.
