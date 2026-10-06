import { Redis } from '@upstash/redis';

const STATE_KEY = 'jukebox:state';
const STATUS_KEY = 'jukebox:status';
const LOCK_KEY = 'jukebox:lock';

// How long a player report stays valid. If the player tab closes, the
// remote shows "player offline" once this runs out.
const STATUS_TTL_SECONDS = 15;

export const MAX_QUEUE = 200;

let client;

// In-memory stand-in used when running locally without Redis. It lives in
// one process only, so it is never used on Vercel.
function createMemoryStore() {
  const data = new Map();
  const live = (key) => {
    const entry = data.get(key);
    if (!entry) return null;
    if (entry.exp && entry.exp < Date.now()) {
      data.delete(key);
      return null;
    }
    return entry;
  };
  return {
    async get(key) {
      const entry = live(key);
      return entry ? JSON.parse(entry.v) : null;
    },
    async mget(...keys) {
      return Promise.all(keys.map((k) => this.get(k)));
    },
    async set(key, value, opts = {}) {
      if (opts.nx && live(key)) return null;
      const ms = opts.px ?? (opts.ex ? opts.ex * 1000 : null);
      data.set(key, { v: JSON.stringify(value), exp: ms ? Date.now() + ms : null });
      return 'OK';
    },
    async del(key) {
      data.delete(key);
      return 1;
    },
  };
}

function redis() {
  if (client) return client;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    client = new Redis({ url, token });
  } else if (process.env.VERCEL) {
    throw new Error('Redis is not connected. In Vercel, add Upstash Redis under Storage and redeploy.');
  } else {
    client = createMemoryStore();
  }
  return client;
}

// Lets tests start from a clean slate.
export function resetStoreForTests() {
  client = createMemoryStore();
}

function defaultState() {
  return { queue: [], current: null, playing: true, volume: 80, rev: 0 };
}

export async function readAll() {
  const [state, status] = await redis().mget(STATE_KEY, STATUS_KEY);
  return { state: state || defaultState(), status: status || null };
}

export async function readState() {
  return (await redis().get(STATE_KEY)) || defaultState();
}

export async function writeStatus(status) {
  await redis().set(STATUS_KEY, status, { ex: STATUS_TTL_SECONDS });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Read-modify-write under a short lock, so two phones tapping at the same
// moment don't overwrite each other's changes.
export async function updateState(mutate) {
  const db = redis();
  const token = Math.random().toString(36).slice(2);
  let locked = false;
  for (let i = 0; i < 30 && !locked; i++) {
    locked = (await db.set(LOCK_KEY, token, { nx: true, px: 3000 })) === 'OK';
    if (!locked) await sleep(100);
  }
  if (!locked) throw new Error('The jukebox is busy, try again.');
  try {
    const state = (await db.get(STATE_KEY)) || defaultState();
    const changed = mutate(state);
    if (changed !== false) {
      state.rev = (state.rev || 0) + 1;
      await db.set(STATE_KEY, state);
    }
    return state;
  } finally {
    await db.del(LOCK_KEY);
  }
}

// Moves the next queued song into "now playing".
export function advance(state) {
  const next = state.queue.shift() || null;
  state.current = next ? { ...next, startedAt: Date.now() } : null;
  state.playing = true;
}
