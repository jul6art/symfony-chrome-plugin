// Stands in for devtools.js outside DevTools: feeds fake requests to panel.js.
// Named mockStore because panel.js already declares a global `store`.
const mockStore = {
  entries: [],
  listeners: new Set(),
  preserveLog: false,
  theme: new URLSearchParams(location.search).get('theme') || 'dark',
  emit(type, entry) { this.listeners.forEach(fn => fn(type, entry)); },
  add(entry) { this.entries.push(entry); this.emit('add', entry); },
  clear() { this.entries = []; this.emit('clear'); },
};

let mockSeq = 0;

function mockRequest(method, url, status, body, { type = 'xhr', profiler = true } = {}) {
  const id = ++mockSeq;
  const token = `ab12${id}`;
  const profilerUrl = profiler ? `https://api.webshop.localhost/_profiler/${token}` : null;
  mockStore.add({
    id, type, method, url, status,
    statusText: status >= 500 ? 'Internal Server Error' : 'OK',
    time: 40 + id * 7,
    startedAt: new Date().toISOString(),
    mimeType: 'application/json',
    requestHeaders: [{ name: 'Accept', value: 'application/ld+json' }],
    responseHeaders: profiler
      ? [{ name: 'X-Debug-Token', value: token }, { name: 'X-Debug-Token-Link', value: profilerUrl }]
      : [],
    requestBody: method === 'POST' || method === 'PUT' ? '{"name":"Foo","tags":[1,2]}' : null,
    profilerUrl,
    body: JSON.stringify(body),
    bodyEncoding: '',
    bodyLoaded: true,
    loadBody() {},
  });
}

// The profiler menu lists a custom performance panel on api.webshop.localhost only.
window.fetch = async url => {
  const custom = new URL(url).hostname === 'api.webshop.localhost';
  const panels = ['request', 'time', 'db', ...(custom ? ['core.performance'] : [])];
  return { ok: true, text: async () => panels.map(p => `<a href="/_profiler/x?panel=${p}&amp;type=request">`).join('') };
};

attach(mockStore);

mockRequest('GET', 'https://api.webshop.localhost/tags?id%5B%5D=7891&id%5B%5D=7885&pagination=false', 200,
  { 'hydra:member': [{ id: 7891, name: 'Red' }, { id: 7885, name: 'Blue' }], 'hydra:totalItems': 2 });
mockRequest('GET', 'https://webshop.localhost/assets/logo.png', 200, {}, { type: 'image', profiler: false });
mockRequest('POST', 'https://api.webshop.localhost/products', 201, { id: 42, name: 'Foo', price: 9.99, meta: null });
mockRequest('PUT', 'https://api.webshop.localhost/orders/7', 500,
  { title: 'An error occurred', detail: 'SQLSTATE[23000]: Integrity constraint violation', status: 500 });

// Read back by scripts/render.sh to check the render without looking at the screenshot.
// Waits one task so the custom panel check has updated the links.
setTimeout(() => {
  const performance = document.querySelector('.profiler-links a[data-performance]');
  document.title = JSON.stringify({
    rows: document.querySelectorAll('.row').length,
    selected: Number(document.querySelector('.row.selected')?.dataset.id),
    profilerLinks: document.querySelectorAll('.profiler-links a').length,
    performancePanel: performance && new URL(performance.href).searchParams.get('panel'),
  });
});
