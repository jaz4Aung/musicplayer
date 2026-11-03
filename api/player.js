import { advance, readState, updateState, writeStatus } from '../lib/store.js';
import { body, clean, handle, pinOk, pinRequired, send } from '../lib/http.js';

// The player page calls this every few seconds (less often when idle): it reports what it is
// doing and gets back what it should be doing.
export default handle(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST.' });
  if (!pinOk(req)) return send(res, 401, { error: 'Wrong PIN.' });

  const input = body(req);
  const event = input.event;
  let state;

  // "ended" and "error" both move on to the next song. Only the song that
  // is actually current can be ended, so repeated reports are harmless.
  if (event && (event.type === 'ended' || event.type === 'error') && event.itemId) {
    state = await updateState((s) => {
      if (s.current?.id !== event.itemId) return false;
      advance(s);
    });
  } else {
    state = await readState();
  }

  // The player leaves out its status when nothing changed, which saves a
  // Redis write on most polls.
  const report = input.status;
  if (report) {
    await writeStatus({
      itemId: clean(report.itemId, 64) || null,
      position: Number(report.position) || 0,
      duration: Number(report.duration) || 0,
      playing: Boolean(report.playing),
      hibernating: Boolean(report.hibernating),
      at: Date.now(),
    });
  }

  send(res, 200, { state, pinRequired: pinRequired(), now: Date.now() });
});
