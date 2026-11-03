import { readAll } from '../lib/store.js';
import { handle, pinRequired, send } from '../lib/http.js';

// Read-only view of the jukebox for the remote pages.
export default handle(async (req, res) => {
  const { state, status } = await readAll();
  // Let Vercel's CDN share one answer between all phones for 2 seconds, so
  // more guests don't mean more Redis reads. Browsers still don't cache it.
  res.setHeader('Vercel-CDN-Cache-Control', 'max-age=2');
  send(res, 200, {
    state,
    status,
    pinRequired: pinRequired(),
    searchEnabled: Boolean(process.env.YOUTUBE_API_KEY),
    now: Date.now(),
  });
});
