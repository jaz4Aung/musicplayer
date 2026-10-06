import { readAll } from '../lib/store.js';
import { handle, pinRequired, send } from '../lib/http.js';

// Read-only view of the jukebox for the remote pages.
export default handle(async (req, res) => {
  const { state, status } = await readAll();
  send(res, 200, {
    state,
    status,
    pinRequired: pinRequired(),
    searchEnabled: Boolean(process.env.YOUTUBE_API_KEY),
    now: Date.now(),
  });
});
