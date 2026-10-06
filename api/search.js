import { clean, handle, pinOk, send } from '../lib/http.js';

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

function decode(text) {
  return String(text || '').replace(/&(amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m]);
}

export default handle(async (req, res) => {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return send(res, 501, { error: 'Search is not set up. Paste a YouTube link instead.' });
  if (!pinOk(req)) return send(res, 401, { error: 'Wrong PIN.' });

  const q = clean(req.query?.q, 100);
  if (!q) return send(res, 200, { results: [] });

  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.search = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    videoEmbeddable: 'true',
    maxResults: '12',
    q,
    key,
  }).toString();

  const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
  const data = await r.json();
  if (!r.ok) {
    const reason = data?.error?.errors?.[0]?.reason;
    const msg = reason === 'quotaExceeded'
      ? 'Daily search limit reached. Paste a YouTube link instead.'
      : 'Search failed. Paste a YouTube link instead.';
    return send(res, 502, { error: msg });
  }

  const results = (data.items || [])
    .filter((it) => it.id?.videoId)
    .map((it) => ({
      videoId: it.id.videoId,
      title: decode(it.snippet.title),
      channel: decode(it.snippet.channelTitle),
    }));
  res.setHeader('Cache-Control', 'public, s-maxage=3600');
  res.status(200).json({ results });
});
