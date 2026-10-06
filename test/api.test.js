// Runs the API handlers against the in-memory store: `npm test`.
import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { resetStoreForTests } from '../lib/store.js';
import { parseVideoId } from '../lib/http.js';
import stateApi from '../api/state.js';
import commandApi from '../api/command.js';
import playerApi from '../api/player.js';
import searchApi from '../api/search.js';

const realFetch = globalThis.fetch;

function call(handler, { method = 'GET', body, query = {}, headers = {} } = {}) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      setHeader() {},
      status(code) { this.statusCode = code; return this; },
      json(data) { resolve({ status: this.statusCode, data }); },
    };
    handler({ method, body, query, headers }, res);
  });
}

const cmd = (body, headers) => call(commandApi, { method: 'POST', body, headers });
const player = (body, headers) => call(playerApi, { method: 'POST', body, headers });

beforeEach(() => {
  resetStoreForTests();
  delete process.env.JUKEBOX_PIN;
  delete process.env.YOUTUBE_API_KEY;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ title: 'Looked Up', author_name: 'Some Channel' }),
  });
});

test('parses YouTube links', () => {
  const id = 'dQw4w9WgXcQ';
  for (const link of [
    id,
    `https://www.youtube.com/watch?v=${id}&t=10`,
    `https://youtu.be/${id}?si=abc`,
    `youtube.com/shorts/${id}`,
    `https://music.youtube.com/watch?v=${id}`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://www.youtube.com/embed/${id}`,
  ]) assert.equal(parseVideoId(link), id, link);
  assert.equal(parseVideoId('https://example.com/watch?v=dQw4w9WgXcQ'), null);
  assert.equal(parseVideoId('hello world'), null);
});

test('first song starts playing, later songs queue', async () => {
  let r = await cmd({ action: 'add', url: 'https://youtu.be/aaaaaaaaaaa', by: 'Mia' });
  assert.equal(r.status, 200);
  assert.equal(r.data.state.current.videoId, 'aaaaaaaaaaa');
  assert.equal(r.data.state.current.title, 'Looked Up');
  assert.equal(r.data.state.current.by, 'Mia');
  r = await cmd({ action: 'add', videoId: 'bbbbbbbbbbb', title: 'B' });
  r = await cmd({ action: 'add', videoId: 'ccccccccccc', title: 'C', next: true });
  assert.deepEqual(r.data.state.queue.map((q) => q.title), ['C', 'B']);
});

test('rejects bad links and unknown actions', async () => {
  assert.equal((await cmd({ action: 'add', url: 'https://example.com' })).status, 400);
  assert.equal((await cmd({ action: 'dance' })).status, 400);
  assert.equal((await call(commandApi, { method: 'GET' })).status, 405);
});

test('bump, remove, clear', async () => {
  await cmd({ action: 'add', videoId: 'aaaaaaaaaaa', title: 'A' });
  await cmd({ action: 'add', videoId: 'bbbbbbbbbbb', title: 'B' });
  let r = await cmd({ action: 'add', videoId: 'ccccccccccc', title: 'C' });
  const c = r.data.state.queue[1];
  r = await cmd({ action: 'bump', id: c.id });
  assert.deepEqual(r.data.state.queue.map((q) => q.title), ['C', 'B']);
  r = await cmd({ action: 'remove', id: c.id });
  assert.deepEqual(r.data.state.queue.map((q) => q.title), ['B']);
  r = await cmd({ action: 'clear' });
  assert.equal(r.data.state.queue.length, 0);
  assert.equal(r.data.state.current.title, 'A');
});

test('skip ignores a stale song id', async () => {
  let r = await cmd({ action: 'add', videoId: 'aaaaaaaaaaa', title: 'A' });
  const a = r.data.state.current.id;
  await cmd({ action: 'add', videoId: 'bbbbbbbbbbb', title: 'B' });
  await cmd({ action: 'add', videoId: 'ccccccccccc', title: 'C' });
  // Two phones press skip on song A at the same time.
  await Promise.all([cmd({ action: 'skip', currentId: a }), cmd({ action: 'skip', currentId: a })]);
  r = await call(stateApi);
  assert.equal(r.data.state.current.title, 'B');
  assert.equal(r.data.state.queue.length, 1);
});

test('pause, play and volume', async () => {
  let r = await cmd({ action: 'pause' });
  assert.equal(r.data.state.playing, false);
  r = await cmd({ action: 'play' });
  assert.equal(r.data.state.playing, true);
  r = await cmd({ action: 'volume', value: 250 });
  assert.equal(r.data.state.volume, 100);
  r = await cmd({ action: 'volume', value: -5 });
  assert.equal(r.data.state.volume, 0);
});

test('player end/error events advance only the current song', async () => {
  let r = await cmd({ action: 'add', videoId: 'aaaaaaaaaaa', title: 'A' });
  const a = r.data.state.current.id;
  await cmd({ action: 'add', videoId: 'bbbbbbbbbbb', title: 'B' });

  r = await player({ event: { type: 'ended', itemId: 'not-current' }, status: { itemId: a, position: 5, duration: 100, playing: true } });
  assert.equal(r.data.state.current.title, 'A');

  r = await player({ event: { type: 'ended', itemId: a } });
  assert.equal(r.data.state.current.title, 'B');
  // A repeated "ended" for A changes nothing.
  r = await player({ event: { type: 'ended', itemId: a } });
  assert.equal(r.data.state.current.title, 'B');

  r = await player({ event: { type: 'error', itemId: r.data.state.current.id } });
  assert.equal(r.data.state.current, null);
});

test('player status is visible to remotes', async () => {
  await player({ status: { itemId: 'x', position: 42, duration: 200, playing: true } });
  const r = await call(stateApi);
  assert.equal(r.data.status.position, 42);
  assert.equal(r.data.status.playing, true);
});

test('concurrent adds are not lost', async () => {
  const ids = 'abcdefghij'.split('').map((ch) => ch.repeat(11));
  await Promise.all(ids.map((videoId) => cmd({ action: 'add', videoId, title: videoId })));
  const r = await call(stateApi);
  assert.equal(r.data.state.queue.length + 1, ids.length);
});

test('PIN protects controls but not viewing', async () => {
  process.env.JUKEBOX_PIN = '1234';
  assert.equal((await cmd({ action: 'pause' })).status, 401);
  assert.equal((await cmd({ action: 'pause' }, { 'x-jukebox-pin': '0000' })).status, 401);
  assert.equal((await cmd({ action: 'pause' }, { 'x-jukebox-pin': '1234' })).status, 200);
  assert.equal((await player({})).status, 401);
  const r = await call(stateApi);
  assert.equal(r.status, 200);
  assert.equal(r.data.pinRequired, true);
});

test('search needs a key and decodes titles', async () => {
  assert.equal((await call(searchApi, { query: { q: 'x' } })).status, 501);
  process.env.YOUTUBE_API_KEY = 'k';
  let requested;
  globalThis.fetch = async (url) => {
    requested = String(url);
    return {
      ok: true,
      json: async () => ({
        items: [{ id: { videoId: 'aaaaaaaaaaa' }, snippet: { title: 'Rock &amp; Roll &quot;Live&quot;', channelTitle: 'Band' } }],
      }),
    };
  };
  const r = await call(searchApi, { query: { q: 'rock' } });
  assert.equal(r.status, 200);
  assert.match(requested, /videoEmbeddable=true/);
  assert.equal(r.data.results[0].title, 'Rock & Roll "Live"');
});

test.after(() => { globalThis.fetch = realFetch; });
