// DevTools panel UI. Receives the shared store from devtools.js through window.attach().

const API_TYPES = new Set(['xhr', 'fetch']);
const PROFILER_PANELS = [
  ['exception', 'Exception', e => e.status >= 400],
  ['db', 'Doctrine', () => true],
  ['logger', 'Logs', () => true],
  ['time', 'Performance', () => true],
  ['request', 'Request', () => true],
];
// A custom performance data collector, named "performance" or "<prefix>.performance"
// (core.performance in jul6art/core-bundle). Linked instead of 'time' when the profiler has one.
const CUSTOM_PERFORMANCE_PANEL = /^([\w-]+\.)*performance$/;
// Profiler origin -> custom panel name or null once found, or the pending lookup.
const customPerformancePanels = new Map();

const els = {
  filter: document.getElementById('filter'),
  xhrOnly: document.getElementById('xhrOnly'),
  follow: document.getElementById('follow'),
  decode: document.getElementById('decode'),
  preserve: document.getElementById('preserve'),
  latestProfiler: document.getElementById('latestProfiler'),
  clear: document.getElementById('clear'),
  count: document.getElementById('count'),
  list: document.getElementById('list'),
  detail: document.getElementById('detail'),
};

const state = {
  filter: '',
  xhrOnly: true,
  follow: true,
  decode: true,
  tab: 'response',
  raw: false,
  selectedId: null,
};

let store = null;

// ---------- helpers ----------

function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k in el && k !== 'list') el[k] = v;
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

function statusClass(status) {
  return 's' + Math.floor((status || 0) / 100);
}

// decodeURI keeps reserved characters such as %26 (&) encoded, so the query stays unambiguous.
function decodeUrl(url) {
  try { return decodeURI(url); } catch { return url; }
}

function displayUrl(url) {
  return state.decode ? decodeUrl(url) : url;
}

function shortPath(url) {
  try {
    const u = new URL(url);
    return displayUrl(u.pathname + u.search);
  } catch {
    return displayUrl(url);
  }
}

function header(headers, name) {
  const found = headers.find(x => x.name.toLowerCase() === name);
  return found ? found.value : null;
}

function bodyText(entry) {
  if (entry.body == null) return null;
  if (entry.bodyEncoding !== 'base64') return entry.body;
  if (!/json|text|xml|javascript/.test(entry.mimeType)) return `[binary ${entry.mimeType}]`;
  const bytes = Uint8Array.from(atob(entry.body), c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function tryJson(text) {
  if (text == null || text === '') return undefined;
  try { return JSON.parse(text); } catch { return undefined; }
}

function copyText(text) {
  // navigator.clipboard is often blocked inside DevTools panels.
  const ta = h('textarea', { value: text });
  document.body.append(ta);
  ta.select();
  document.execCommand('copy');
  ta.remove();
}

function profilerLink(url, panel) {
  if (!panel) return url;
  const u = new URL(url);
  u.searchParams.set('panel', panel);
  return u.href;
}

// Returns the panel to link for "Performance". The first call per origin reads the profiler
// page, whose menu links every panel as ?panel=<name>, then updates the links already on screen.
function performancePanel(profilerUrl) {
  const origin = new URL(profilerUrl).origin;
  const known = customPerformancePanels.get(origin);
  if (typeof known === 'string') return known;
  if (known === null) return 'time';
  if (!known) {
    customPerformancePanels.set(origin, fetch(profilerUrl)
      .then(res => {
        if (!res.ok) throw new Error(`profiler answered ${res.status}`);
        return res.text();
      })
      .then(html => {
        const panel = [...html.matchAll(/[?&](?:amp;)?panel=([\w.-]+)/g)]
          .map(m => m[1])
          .find(name => CUSTOM_PERFORMANCE_PANEL.test(name)) || null;
        customPerformancePanels.set(origin, panel);
        if (panel) useCustomPerformancePanel(origin, panel);
      })
      // Network error or expired profile: forget the lookup so the next render retries.
      .catch(() => customPerformancePanels.delete(origin)));
  }
  return 'time';
}

function useCustomPerformancePanel(origin, panel) {
  for (const a of document.querySelectorAll('a[data-performance]')) {
    if (new URL(a.href).origin === origin) a.href = profilerLink(a.href, panel);
  }
}

function savePrefs() {
  try {
    localStorage.setItem('prefs', JSON.stringify({ xhrOnly: state.xhrOnly, follow: state.follow, decode: state.decode }));
  } catch {}
}

function loadPrefs() {
  try {
    const prefs = JSON.parse(localStorage.getItem('prefs') || '{}');
    if (typeof prefs.xhrOnly === 'boolean') state.xhrOnly = prefs.xhrOnly;
    if (typeof prefs.follow === 'boolean') state.follow = prefs.follow;
    if (typeof prefs.decode === 'boolean') state.decode = prefs.decode;
  } catch {}
  els.xhrOnly.checked = state.xhrOnly;
  els.follow.checked = state.follow;
  els.decode.checked = state.decode;
}

// ---------- list ----------

function isVisible(entry) {
  if (state.xhrOnly && !API_TYPES.has(entry.type)) return false;
  if (!state.filter) return true;
  const haystack = `${entry.method} ${entry.status} ${entry.url} ${decodeUrl(entry.url)}`.toLowerCase();
  return state.filter.split(/\s+/).every(term => haystack.includes(term));
}

function visibleEntries() {
  return store ? store.entries.filter(isVisible).reverse() : [];
}

function createRow(entry) {
  return h('li', {
    class: 'row' + (entry.id === state.selectedId ? ' selected' : ''),
    'data-id': entry.id,
    title: displayUrl(entry.url),
    onclick: () => select(entry.id),
  },
    h('span', { class: `status ${statusClass(entry.status)}` }, entry.status || 'ERR'),
    h('span', { class: 'method' }, entry.method),
    h('span', { class: 'path' }, shortPath(entry.url)),
    h('span', { class: 'time' }, `${entry.time} ms`),
    entry.profilerUrl
      ? h('a', {
          class: 'prof',
          href: profilerLink(entry.profilerUrl, entry.status >= 400 ? 'exception' : null),
          target: '_blank',
          rel: 'noopener',
          title: 'Open Symfony profiler',
          onclick: e => e.stopPropagation(),
        }, '⏱')
      : h('span'),
  );
}

function renderList() {
  const entries = visibleEntries();
  els.list.replaceChildren(...entries.map(createRow));
  updateCounters();
}

function updateCounters() {
  const visible = visibleEntries();
  els.count.textContent = store ? `${visible.length} / ${store.entries.length}` : '';
  els.latestProfiler.disabled = !visible.some(e => e.profilerUrl);
}

function highlightSelection() {
  for (const row of els.list.children) {
    row.classList.toggle('selected', Number(row.dataset.id) === state.selectedId);
  }
  const current = els.list.querySelector('.selected');
  if (current) current.scrollIntoView({ block: 'nearest' });
}

function select(id) {
  state.selectedId = id;
  highlightSelection();
  renderDetail();
}

function moveSelection(delta) {
  const entries = visibleEntries();
  if (!entries.length) return;
  const index = entries.findIndex(e => e.id === state.selectedId);
  const next = Math.min(entries.length - 1, Math.max(0, index + delta));
  select(entries[next].id);
}

// ---------- detail ----------

function selectedEntry() {
  return store && store.entries.find(e => e.id === state.selectedId);
}

function renderDetail() {
  const entry = selectedEntry();
  if (!entry) {
    els.detail.replaceChildren(h('p', { class: 'empty muted' }, 'Select a request.'));
    return;
  }
  entry.loadBody();

  const tabs = [['response', 'Response'], ['payload', 'Payload'], ['headers', 'Headers']];
  const text = bodyText(entry);

  els.detail.replaceChildren(
    renderSummary(entry),
    h('nav', { class: 'tabs' },
      tabs.map(([key, label]) => h('button', {
        type: 'button',
        class: state.tab === key ? 'active' : '',
        onclick: () => { state.tab = key; renderDetail(); },
      }, label)),
      h('span', { class: 'spacer' }),
      state.tab === 'response' && text != null && h('button', {
        type: 'button',
        class: 'action',
        onclick: () => { state.raw = !state.raw; renderDetail(); },
      }, state.raw ? 'Tree' : 'Raw'),
      state.tab === 'response' && text != null && h('button', {
        type: 'button',
        class: 'action',
        onclick: e => { copyText(text); e.target.textContent = 'Copied'; },
      }, 'Copy'),
    ),
    h('div', { class: 'tab-body' },
      state.tab === 'response' ? renderResponse(entry, text)
        : state.tab === 'payload' ? renderPayload(entry)
        : renderHeaders(entry)),
  );
}

function renderSummary(entry) {
  const links = entry.profilerUrl && h('div', { class: 'profiler-links' },
    h('a', { class: 'primary', href: entry.profilerUrl, target: '_blank', rel: 'noopener' }, 'Profiler ↗'),
    PROFILER_PANELS
      .filter(([, , show]) => show(entry))
      .map(([panel, label]) => panel === 'time'
        ? h('a', {
            href: profilerLink(entry.profilerUrl, performancePanel(entry.profilerUrl)),
            target: '_blank', rel: 'noopener', 'data-performance': '',
          }, label)
        : h('a', {
            href: profilerLink(entry.profilerUrl, panel), target: '_blank', rel: 'noopener',
          }, label)),
  );

  return h('div', { class: 'summary' },
    h('div', { class: 'meta' },
      h('span', { class: `status ${statusClass(entry.status)}` }, entry.status || 'ERR'),
      h('span', { class: 'method' }, entry.method),
      h('span', { class: 'muted' }, entry.statusText),
      h('span', { class: 'muted' }, `${entry.time} ms`),
      h('span', { class: 'muted' }, entry.mimeType),
      h('span', { class: 'muted' }, new Date(entry.startedAt).toLocaleTimeString()),
    ),
    h('div', { class: 'url' }, displayUrl(entry.url)),
    links || h('div', { class: 'muted' }, 'No X-Debug-Token header on this response.'),
  );
}

function renderResponse(entry, text) {
  if (!entry.bodyLoaded) return h('p', { class: 'muted' }, 'Loading…');
  if (text == null || text === '') return h('p', { class: 'muted' }, 'Empty response body.');
  const json = tryJson(text);
  if (json === undefined || state.raw) {
    return h('pre', { class: 'raw' }, json !== undefined ? JSON.stringify(json, null, 2) : text);
  }
  return jsonTree(json, null, 0);
}

function renderPayload(entry) {
  const parts = [];
  let params = [];
  try { params = [...new URL(entry.url).searchParams]; } catch {}

  if (params.length) {
    parts.push(h('h3', {}, 'Query string'), kvTable(params.map(([k, v]) => ({ name: k, value: v }))));
  }
  if (entry.requestBody != null) {
    const json = tryJson(entry.requestBody);
    parts.push(h('h3', {}, 'Request body'),
      json !== undefined ? jsonTree(json, null, 0) : h('pre', { class: 'raw' }, entry.requestBody));
  }
  return parts.length ? parts : h('p', { class: 'muted' }, 'No query string or request body.');
}

function renderHeaders(entry) {
  return [
    h('h3', {}, 'Response headers'),
    kvTable(entry.responseHeaders, name => name.startsWith('x-debug-token')),
    h('h3', {}, 'Request headers'),
    kvTable(entry.requestHeaders),
  ];
}

function kvTable(rows, highlight = () => false) {
  return h('table', { class: 'kv' },
    h('tbody', {}, rows.map(r => h('tr', { class: highlight(r.name.toLowerCase()) ? 'highlight' : '' },
      h('td', {}, r.name),
      h('td', {}, r.value),
    ))),
  );
}

// ---------- JSON tree ----------

function keyNode(key) {
  return key == null ? null : h('span', { class: 'jt-key' }, `${key}: `);
}

function valueNode(value) {
  if (typeof value === 'string') return h('span', { class: 'jt-string' }, JSON.stringify(value));
  if (typeof value === 'number') return h('span', { class: 'jt-number' }, String(value));
  return h('span', { class: 'jt-literal' }, String(value));
}

function jsonTree(value, key, depth) {
  if (value === null || typeof value !== 'object') {
    return h('div', { class: 'jt-leaf' }, keyNode(key), valueNode(value));
  }

  const isArray = Array.isArray(value);
  const items = isArray ? value.map((v, i) => [i, v]) : Object.entries(value);
  const meta = isArray ? `Array(${items.length})` : `{${items.length}}`;
  const details = h('details', { class: 'jt' }, h('summary', {}, keyNode(key), h('span', { class: 'jt-meta' }, meta)));

  // Children are built on first expand, so large payloads stay fast.
  let built = false;
  const build = () => {
    if (built) return;
    built = true;
    details.append(...items.map(([k, v]) => jsonTree(v, k, depth + 1)));
  };
  details.addEventListener('toggle', () => details.open && build());
  if (depth < 2) {
    details.open = true;
    build();
  }
  return details;
}

// ---------- store events ----------

function onStoreEvent(type, entry) {
  if (type === 'clear') {
    state.selectedId = null;
    renderList();
    renderDetail();
    return;
  }

  if (type === 'add') {
    if (isVisible(entry)) {
      els.list.prepend(createRow(entry));
      if (state.follow) select(entry.id);
    }
    // The store drops old entries past its limit.
    const known = new Set(store.entries.map(e => e.id));
    for (const row of [...els.list.children]) {
      if (!known.has(Number(row.dataset.id))) row.remove();
    }
    updateCounters();
    return;
  }

  if (type === 'update' && entry.id === state.selectedId) renderDetail();
}

// ---------- wiring ----------

els.filter.addEventListener('input', () => {
  state.filter = els.filter.value.trim().toLowerCase();
  renderList();
});

els.xhrOnly.addEventListener('change', () => {
  state.xhrOnly = els.xhrOnly.checked;
  savePrefs();
  renderList();
});

els.follow.addEventListener('change', () => {
  state.follow = els.follow.checked;
  savePrefs();
  if (state.follow) {
    const latest = visibleEntries()[0];
    if (latest) select(latest.id);
  }
});

els.decode.addEventListener('change', () => {
  state.decode = els.decode.checked;
  savePrefs();
  renderList();
  renderDetail();
});

els.preserve.addEventListener('change', () => {
  if (store) store.preserveLog = els.preserve.checked;
});

els.clear.addEventListener('click', () => store && store.clear());

els.latestProfiler.addEventListener('click', () => {
  const latest = visibleEntries().find(e => e.profilerUrl);
  if (latest) window.open(latest.profilerUrl, '_blank', 'noopener');
});

document.addEventListener('keydown', e => {
  if (e.target === els.filter) return;
  if (e.key === 'ArrowDown') { moveSelection(1); e.preventDefault(); }
  if (e.key === 'ArrowUp') { moveSelection(-1); e.preventDefault(); }
  if (e.key === 'p') {
    const entry = selectedEntry();
    if (entry && entry.profilerUrl) window.open(entry.profilerUrl, '_blank', 'noopener');
  }
});

function attach(sharedStore) {
  store = sharedStore;
  document.documentElement.dataset.theme = store.theme === 'dark' ? 'dark' : 'light';
  els.preserve.checked = store.preserveLog;
  store.listeners.add(onStoreEvent);
  window.addEventListener('unload', () => store.listeners.delete(onStoreEvent));

  renderList();
  const latest = visibleEntries()[0];
  if (latest) select(latest.id);
}

window.attach = attach;
loadPrefs();
