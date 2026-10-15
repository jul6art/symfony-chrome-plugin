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
  const profilerUrl = profiler ? `${new URL(url).origin}/_profiler/${token}` : null;
  mockStore.add({
    id, type, method, url, status,
    statusText: { 200: 'OK', 201: 'Created', 422: 'Unprocessable Content', 500: 'Internal Server Error' }[status] || '',
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

// The profiler menu lists a custom performance panel on api.acme.localhost only.
window.fetch = async url => {
  const custom = new URL(url).hostname === 'api.acme.localhost';
  const panels = ['request', 'time', 'db', ...(custom ? ['core.performance'] : [])];
  return { ok: true, text: async () => panels.map(p => `<a href="/_profiler/x?panel=${p}&amp;type=request">`).join('') };
};

attach(mockStore);

// Also the data of the Chrome Web Store screenshots (scripts/store-assets.sh): the last call is
// the one selected.
const API = 'https://api.acme.localhost/api';
mockRequest('GET', `${API}/users/me`, 200, { '@id': '/api/users/12', id: 12, email: 'jane@acme.test', roles: ['ROLE_USER'] });
mockRequest('GET', 'https://acme.localhost/assets/logo.png', 200, {}, { type: 'image', profiler: false });
mockRequest('GET', 'https://cdn.acme.localhost/i18n/en.json', 200, { 'cart.empty': 'Your cart is empty' }, { profiler: false });
mockRequest('GET', `${API}/categories?pagination=false`, 200,
  { 'hydra:member': [{ id: 3, name: 'Shoes' }, { id: 8, name: 'Bags' }], 'hydra:totalItems': 2 });
mockRequest('POST', `${API}/carts`, 201, { '@id': '/api/carts/42', id: 42, items: [], total: 0 });
mockRequest('POST', `${API}/carts/42/items`, 422,
  { title: 'Validation Failed', violations: [{ propertyPath: 'quantity', message: 'This value should be positive.' }] });
mockRequest('PUT', `${API}/orders/7`, 500,
  { title: 'An error occurred', detail: 'SQLSTATE[23000]: Integrity constraint violation', status: 500 });
mockRequest('GET', `${API}/addresses?user=12`, 200,
  { 'hydra:member': [{ id: 5, city: 'Luxembourg', default: true }], 'hydra:totalItems': 1 });
mockRequest('GET', `${API}/products?category%5B%5D=3&category%5B%5D=8&order%5Bprice%5D=asc&page=1`, 200, {
  '@context': '/api/contexts/Product',
  '@id': '/api/products',
  '@type': 'hydra:Collection',
  'hydra:totalItems': 24,
  'hydra:member': [
    { '@id': '/api/products/17', id: 17, name: 'Leather tote', price: 89.9, inStock: true, category: '/api/categories/8' },
    { '@id': '/api/products/9', id: 9, name: 'Trail runner', price: 119, inStock: false, category: '/api/categories/3' },
  ],
  'hydra:view': { '@id': '/api/products?page=1', 'hydra:next': '/api/products?page=2' },
});

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
