// Fake Symfony API for the end-to-end test: JSON endpoints with X-Debug-Token headers, and a
// profiler whose menu lists its panels, plus performancePanel when given. Records every profiler hit.
// X-Debug-Token-Link points under /index.php, so a link built from X-Debug-Token alone differs.
import http from 'node:http';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64');

export function startServer({ performancePanel = null } = {}) {
  const profilerHits = [];
  let token = 0;
  let base;

  // debug: 'link' sends both headers, as Symfony does; 'token' sends X-Debug-Token only.
  function json(res, status, body, debug = 'link') {
    // The app page calls a second server in the test: let it read the answer.
    const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
    if (debug) {
      const t = `tok${++token}`;
      headers['X-Debug-Token'] = t;
      if (debug === 'link') headers['X-Debug-Token-Link'] = `${base}/index.php/_profiler/${t}`;
    }
    res.writeHead(status, headers);
    res.end(JSON.stringify(body));
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, base);
    if (url.pathname.includes('/_profiler/')) {
      profilerHits.push(`${req.method} ${url.pathname}${url.search}`);
      // Same menu markup as WebProfilerBundle's layout: one ?panel=<name> link per panel.
      const panels = ['request', 'time', 'exception', 'logger', 'db', ...(performancePanel ? [performancePanel] : [])];
      const menu = panels.map(p => `<li class="${p}"><a href="${url.pathname}?panel=${p}&amp;type=request">${p}</a></li>`);
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(`<h1>Profiler ${url.pathname}</h1><ul id="menu-profiler">${menu.join('')}</ul>`);
    }
    if (url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end('<!doctype html><title>Fake app</title><h1>Fake app</h1>');
    }
    if (url.pathname === '/img.png') {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      return res.end(PNG);
    }
    if (url.pathname === '/api/orders' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => (body += chunk));
      return req.on('end', () => json(res, 201, { id: 3, created: true, echo: JSON.parse(body || '{}') }));
    }
    if (url.pathname === '/api/orders') {
      return json(res, 200, { total: 2, items: [{ id: 1, status: 'open', lines: [{ sku: 'A', qty: 2 }] }, { id: 2, status: 'closed' }] });
    }
    if (url.pathname === '/api/fail') return json(res, 500, { title: 'Internal Server Error', detail: 'Boom' }, 'token');
    if (url.pathname === '/api/plain') return json(res, 200, { ok: true }, null);
    res.writeHead(404);
    res.end();
  });

  // localhost, not 127.0.0.1: the manifest's host_permissions only cover localhost.
  return new Promise(resolve => server.listen(0, 'localhost', () => {
    base = `http://localhost:${server.address().port}`;
    resolve({ base, profilerHits, close: () => server.close() });
  }));
}
