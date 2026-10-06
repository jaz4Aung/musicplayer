# Party Jukebox

Play YouTube on one computer (the **player**) and control it from any phone (the **remote**).
Hosted on Vercel. Free tier is enough.

## Deploy

1. Put this folder in a GitHub repo (or run `npx vercel` in this folder).
2. Import it in Vercel. No build settings needed.
3. In the Vercel project: **Storage > Marketplace > Upstash Redis** (free plan). Connect it to the project.
   This adds the `KV_REST_API_URL` / `KV_REST_API_TOKEN` variables automatically.
4. (Optional) **Settings > Environment Variables**:
   - `YOUTUBE_API_KEY` : enables song search (YouTube Data API v3, free key from Google Cloud Console).
     Without it you can still paste YouTube links.
   - `JUKEBOX_PIN` : a shared PIN so strangers with the link cannot control your music.
5. Redeploy so the variables take effect.

## Use

- On the desktop (plugged into the receiver/speakers): open `https://your-app.vercel.app/player` in Brave, click **Start the jukebox**, leave the tab open.
- On phones: open `https://your-app.vercel.app/remote`.

## Notes

- Vercel has no WebSockets, so pages refresh every 3 seconds. Commands feel near-instant on the phone and reach the player within ~3 seconds.
- Upstash's free plan has a monthly command limit. Close the player tab when you are not using it.
- Videos whose owners disabled embedding are skipped automatically.
