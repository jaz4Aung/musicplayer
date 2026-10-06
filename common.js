// Shared helpers for the player and remote pages.

const store = {
  get(key) {
    try { return localStorage.getItem(key) || ''; } catch { return ''; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch {}
  },
};

class PinError extends Error {}

async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'x-jukebox-pin': store.get('jukebox-pin') };
  if (body) headers['content-type'] = 'application/json';
  const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = {};
  try { data = await res.json(); } catch {}
  if (res.status === 401) throw new PinError(data.error || 'Wrong PIN.');
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
  return data;
}

function askPin(message) {
  const pin = prompt(message || 'Enter the jukebox PIN');
  if (pin !== null) store.set('jukebox-pin', pin.trim());
  return pin !== null;
}

function thumb(videoId) {
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/mqdefault.jpg`;
}

function fmtTime(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Small DOM builder; text always goes in as textContent, so song titles
// can never inject HTML.
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

let toastTimer;
function toast(message) {
  let t = document.querySelector('.toast');
  if (!t) {
    t = el('div', { class: 'toast', role: 'status' });
    document.body.append(t);
  }
  t.textContent = message;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
