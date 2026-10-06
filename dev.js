// Local test server: `npm run dev`, then open http://localhost:3000.
// Uses an in-memory store unless KV_REST_API_URL/TOKEN are set.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = new URL('.', import.meta.url).pathname;
const port = Number(process.env.PORT) || 3000;
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json' };
const apis = ['state', 'command', 'player', 'search'];

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const api = url.pathname.match(/^\/api\/(\w+)$/)?.[1];

  if (api && apis.includes(api)) {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    req.body = raw;
    req.query = Object.fromEntries(url.searchParams);
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (data) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(data)); };
    const { default: handler } = await import(`./api/${api}.js`);
    return handler(req, res);
  }

  // Same clean URLs as vercel.json: /remote serves remote.html.
  let path = url.pathname === '/' ? '/index.html' : url.pathname;
  if (!extname(path)) path += '.html';
  const file = normalize(join(root, path));
  if (!file.startsWith(root) || /\/(api|lib|test|node_modules)\//.test(file.slice(root.length - 1))) {
    res.statusCode = 404;
    return res.end('Not found');
  }
  try {
    const data = await readFile(file);
    res.setHeader('content-type', types[extname(file)] || 'application/octet-stream');
    res.end(data);
  } catch {
    res.statusCode = 404;
    res.end('Not found');
  }
}).listen(port, () => console.log(`Jukebox running at http://localhost:${port}`));
