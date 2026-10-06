import { randomUUID } from 'node:crypto';
import { MAX_QUEUE, advance, readAll, updateState } from '../lib/store.js';
import { body, clean, handle, parseVideoId, pinOk, send } from '../lib/http.js';

// Looks up a title for pasted links. Needs no API key.
async function lookupTitle(videoId) {
  try {
    const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(
      `https://www.youtube.com/watch?v=${videoId}`,
    )}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return {};
    const data = await r.json();
    return { title: data.title, channel: data.author_name };
  } catch {
    return {};
  }
}

export default handle(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST.' });
  if (!pinOk(req)) return send(res, 401, { error: 'Wrong PIN.' });

  const input = body(req);
  const action = input.action;
  let item;

  if (action === 'add') {
    const videoId = parseVideoId(input.videoId || input.url);
    if (!videoId) return send(res, 400, { error: "That doesn't look like a YouTube link." });
    let { title, channel } = input;
    if (!title) ({ title, channel } = await lookupTitle(videoId));
    item = {
      id: randomUUID(),
      videoId,
      title: clean(title) || 'YouTube video',
      channel: clean(channel, 100),
      by: clean(input.by, 40),
      addedAt: Date.now(),
    };
  }

  let error = null;
  await updateState((state) => {
    switch (action) {
      case 'add':
        if (state.queue.length >= MAX_QUEUE) {
          error = 'The queue is full.';
          return false;
        }
        if (input.next) state.queue.unshift(item);
        else state.queue.push(item);
        if (!state.current) advance(state);
        return;
      case 'remove': {
        const before = state.queue.length;
        state.queue = state.queue.filter((q) => q.id !== input.id);
        return state.queue.length !== before;
      }
      case 'bump': {
        const i = state.queue.findIndex((q) => q.id === input.id);
        if (i <= 0) return false;
        state.queue.unshift(...state.queue.splice(i, 1));
        return;
      }
      case 'skip':
        // Ignore a skip aimed at a song that already changed, so two
        // people tapping skip at once don't skip two songs.
        if (input.currentId && state.current?.id !== input.currentId) return false;
        advance(state);
        return;
      case 'pause':
        state.playing = false;
        return;
      case 'play':
        state.playing = true;
        return;
      case 'volume': {
        const v = Math.round(Number(input.value));
        if (!Number.isFinite(v)) return false;
        state.volume = Math.min(100, Math.max(0, v));
        return;
      }
      case 'clear':
        state.queue = [];
        return;
      default:
        error = 'Unknown action.';
        return false;
    }
  });

  if (error) return send(res, 400, { error });
  send(res, 200, { ...(await readAll()), now: Date.now() });
});
