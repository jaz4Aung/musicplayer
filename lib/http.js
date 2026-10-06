import { timingSafeEqual } from 'node:crypto';

export function pinRequired() {
  return Boolean(process.env.JUKEBOX_PIN);
}

export function pinOk(req) {
  const expected = process.env.JUKEBOX_PIN;
  if (!expected) return true;
  const given = String(req.headers['x-jukebox-pin'] || '');
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function send(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}

export function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try {
    return JSON.parse(req.body || '{}');
  } catch {
    return {};
  }
}

// Wraps a handler so thrown errors become a JSON message the pages can show.
export function handle(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      console.error(err);
      send(res, 500, { error: err.message || 'Something went wrong.' });
    }
  };
}

// Accepts a bare 11-character video ID or any common YouTube link form.
export function parseVideoId(input) {
  const text = String(input || '').trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(text)) return text;
  let url;
  try {
    url = new URL(text.startsWith('http') ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, '');
  let id = null;
  if (host === 'youtu.be') {
    id = url.pathname.slice(1).split('/')[0];
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = url.searchParams.get('v');
    if (!id) {
      const m = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/);
      if (m) id = m[1];
    }
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

export function clean(text, max = 200) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, max);
}
