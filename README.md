# Party Jukebox

Play YouTube on one computer (the **player**) and control it from any phone (the **remote**).
Hosted on Vercel. Free tier is enough.

## Deploy

1. Import this GitHub repo in Vercel. No build settings needed.
2. In the Vercel project: **Storage > Marketplace > Upstash Redis** (free plan). Connect it to the project.
   This adds the `KV_REST_API_URL` / `KV_REST_API_TOKEN` variables automatically.
3. (Optional) **Settings > Environment Variables**:
   - `YOUTUBE_API_KEY` : enables song search (YouTube Data API v3, free key from Google Cloud Console).
     Without it you can still paste YouTube links.
   - `JUKEBOX_PIN` : a shared PIN so strangers with the link cannot control your music.
4. Redeploy so the variables take effect.

## Use

- On the desktop (plugged into the receiver/speakers): open `https://your-app.vercel.app/player` in Brave, click **Start the jukebox**, leave the tab open.
- On phones: scan the QR code on the player screen, or open `https://your-app.vercel.app/remote`.

## Run locally

```
npm install
npm run dev     # http://localhost:3000, uses an in-memory store
npm test        # API tests
```

## How it works

- `player.html` runs the YouTube player. Every 3 seconds it reports what it is playing to `/api/player` and gets back the queue, play/pause and volume.
- `remote.html` reads `/api/state` and sends actions (add, skip, pause, volume, ...) to `/api/command`.
- `/api/search` searches YouTube when `YOUTUBE_API_KEY` is set.
- All state lives in one Redis key (`lib/store.js`).

## Notes

- Vercel has no WebSockets, so pages refresh every 3 seconds. Commands feel near-instant on the phone and reach the player within ~3 seconds.
- Upstash's free plan has a monthly command limit. Close the player tab when you are not using it.
- Keep the player tab visible. Browsers slow down timers in background tabs, which can delay the first song.
- Videos whose owners disabled embedding are skipped automatically.
