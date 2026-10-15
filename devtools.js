// Runs as soon as DevTools opens: captures requests even before the panel is shown,
// then hands the shared store to the panel window.

const MAX_ENTRIES = 500;
const API_TYPES = new Set(['xhr', 'fetch']);

const store = {
  entries: [],
  listeners: new Set(),
  preserveLog: false,
  theme: chrome.devtools.panels.themeName,

  emit(type, entry) {
    for (const fn of this.listeners) {
      try { fn(type, entry); } catch (e) { console.error(e); }
    }
  },
  add(entry) {
    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) this.entries.shift();
    this.emit('add', entry);
  },
  clear() {
    this.entries = [];
    this.emit('clear');
  },
};

let seq = 0;

function findHeader(headers, name) {
  const h = headers.find(h => h.name.toLowerCase() === name);
  return h ? h.value : null;
}

function profilerUrl(har) {
  const headers = har.response.headers;
  const link = findHeader(headers, 'x-debug-token-link');
  if (link) return new URL(link, har.request.url).href;
  const token = findHeader(headers, 'x-debug-token');
  if (token) return new URL(`/_profiler/${token}`, har.request.url).href;
  return null;
}

chrome.devtools.network.onRequestFinished.addListener(har => {
  const entry = {
    id: ++seq,
    type: har._resourceType || 'other',
    method: har.request.method,
    url: har.request.url,
    status: har.response.status,
    statusText: har.response.statusText,
    time: Math.round(har.time),
    startedAt: har.startedDateTime,
    mimeType: har.response.content.mimeType || '',
    requestHeaders: har.request.headers,
    responseHeaders: har.response.headers,
    requestBody: har.request.postData ? har.request.postData.text : null,
    profilerUrl: profilerUrl(har),
    body: null,
    bodyEncoding: null,
    bodyLoaded: false,
  };

  // Loads the response body once; API calls are loaded eagerly, the rest on demand.
  entry.loadBody = () => {
    if (entry.bodyLoaded || entry.bodyLoading) return;
    entry.bodyLoading = true;
    har.getContent((content, encoding) => {
      entry.body = content;
      entry.bodyEncoding = encoding;
      entry.bodyLoaded = true;
      store.emit('update', entry);
    });
  };

  store.add(entry);
  if (API_TYPES.has(entry.type)) entry.loadBody();
});

chrome.devtools.network.onNavigated.addListener(() => {
  if (!store.preserveLog) store.clear();
});

chrome.devtools.panels.create('Symfony', '', 'panel.html', panel => {
  panel.onShown.addListener(win => {
    if (win.__symfonyDebugAttached) return;
    win.__symfonyDebugAttached = true;
    win.attach(store);
  });
});
