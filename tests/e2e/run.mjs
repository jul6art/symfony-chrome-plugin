// End-to-end test: the extension in a real DevTools, with the real chrome.devtools API, against
// the fake Symfony API of server.mjs. Covers devtools.js, which scripts/render.sh cannot.
// Usage: node tests/e2e/run.mjs <chrome-for-testing binary> <extension dir> <screenshot.png> [headed]
import { writeFileSync } from 'node:fs';
import { launch, sleep } from './cdp.mjs';
import { startServer } from './server.mjs';

const [chrome, ext, shot, mode] = process.argv.slice(2);
if (!chrome || !ext || !shot) {
  console.error('Usage: node tests/e2e/run.mjs <chrome-for-testing binary> <extension dir> <screenshot.png> [headed]');
  process.exit(2);
}

const results = [];
const check = (name, ok, detail) => results.push({ ok: !!ok, name, detail });

// Retries until fn returns something truthy. Errors count as "not yet": a page that is
// navigating rejects evaluations for a moment.
async function waitFor(fn, what, timeout = 20000) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    try {
      const v = await fn();
      if (v) return v;
    } catch (e) { last = e; }
    await sleep(100);
  }
  throw new Error(`timeout waiting for ${what}${last ? `: ${last.message}` : ''}`);
}
const settle = (fn, what) => waitFor(fn, what, 5000).catch(() => false);

// The app's API has a custom performance panel; the second API has none.
const server = await startServer({ performancePanel: 'core.performance' });
const plain = await startServer();
const APP = server.base;
const cdp = await launch({ chrome, ext, url: `${APP}/`, headless: mode !== 'headed' });

try {
  const find = re => cdp.targets().then(ts => ts.find(t => re.test(t.url)));
  const devtoolsPage = await waitFor(() => find(/^chrome-extension:\/\/[a-p]{32}\/devtools\.html/), 'devtools.html');
  const extId = new URL(devtoolsPage.url).host;
  const page = await waitFor(() => find(new RegExp(`^${APP}/`)), 'app page');
  const devtools = await waitFor(() => find(/^devtools:\/\//), 'DevTools');
  const pageS = await cdp.attach(page.targetId);
  const dtS = await cdp.attach(devtools.targetId);
  const capS = await cdp.attach(devtoolsPage.targetId);
  await waitFor(() => cdp.evaluate(capS, `typeof store === 'object'`), 'devtools.js store');
  check('extension loaded, devtools.js running', extId, devtoolsPage.url);

  // 1. Requests made before the Symfony tab is ever shown.
  await cdp.evaluate(pageS, `(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    await fetch('/api/orders'); await wait(50);
    await new Promise(ok => { const x = new XMLHttpRequest(); x.onloadend = ok; x.open('GET', '/api/orders?filter%5Bstatus%5D=open'); x.send(); }); await wait(50);
    await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Foo', tags: [1, 2] }) }); await wait(50);
    await fetch('/api/fail'); await wait(50);
    await fetch('/api/plain'); await wait(50);
    await new Promise(ok => { const i = new Image(); i.onload = i.onerror = ok; i.src = '/img.png'; });
  })()`);
  const captured = await settle(async () => {
    const all = await cdp.evaluate(capS, `store.entries.map(e => [e.type, e.method, e.status, new URL(e.url).pathname, e.profilerUrl])`);
    return all.filter(e => e[0] === 'xhr' || e[0] === 'fetch').length >= 5 && all.some(e => e[3] === '/img.png') && all;
  }, 'captured requests') || await cdp.evaluate(capS, `store.entries.map(e => [e.type, e.method, e.status, new URL(e.url).pathname])`);
  const api = captured.filter(e => e[0] === 'xhr' || e[0] === 'fetch');
  check('devtools.js captures before the panel is shown (5 API calls)', api.length === 5, captured);
  check('devtools.js keeps non-API requests too', captured.some(e => e[3] === '/img.png'), captured);
  check('profiler link read from X-Debug-Token-Link',
    api.filter(e => e[3] === '/api/orders').every(e => /^http:\/\/localhost:\d+\/index\.php\/_profiler\/tok\d+$/.test(e[4])), api);
  check('without the link, /_profiler/{X-Debug-Token} on the request host',
    /^http:\/\/localhost:\d+\/_profiler\/tok\d+$/.test(api.find(e => e[3] === '/api/fail')?.[4]), api);
  check('no profiler link without X-Debug-Token', api.find(e => e[3] === '/api/plain')?.[4] === null, api);

  // 2. Show the Symfony tab, as a click on it would.
  const viewId = `chrome-extension://${extId}Symfony`;
  await cdp.evaluate(dtS, `(async () => {
    const UI = await import('./ui/legacy/legacy.js');
    await UI.ViewManager.ViewManager.instance().showView(${JSON.stringify(viewId)});
  })()`);
  const panelT = await waitFor(() => find(/^chrome-extension:\/\/[a-p]{32}\/panel\.html/), 'panel.html');
  const panelS = await cdp.attach(panelT.targetId);

  const rows = () => cdp.evaluate(panelS, `[...document.querySelectorAll('#list .row')].map(r => ({
    status: r.querySelector('.status').textContent, method: r.querySelector('.method').textContent,
    path: r.querySelector('.path').textContent, selected: r.classList.contains('selected'),
    prof: r.querySelector('a.prof')?.href || null }))`);
  const detail = () => cdp.evaluate(panelS, `({
    url: document.querySelector('.summary .url')?.textContent,
    links: [...document.querySelectorAll('.profiler-links a')].map(a => [a.textContent, a.href]),
    body: document.querySelector('.tab-body')?.textContent.slice(0, 300),
    tab: document.querySelector('.tabs button.active')?.textContent })`);
  const click = selector => cdp.evaluate(panelS, `(${selector}).click()`);
  const row = test => `[...document.querySelectorAll('#list .row')].find(r => ${test})`;
  const tab = label => `[...document.querySelectorAll('.tabs button')].find(b => b.textContent === ${JSON.stringify(label)})`;

  let r = await waitFor(async () => { const v = await rows(); return v.length >= 5 && v; }, 'rows');
  check('panel lists the 5 API calls, newest first', r.length === 5 && r[0].path === '/api/plain' && r[4].path === '/api/orders', r);
  check('XHR/fetch only hides the image', !r.some(x => x.path.includes('img.png')), r);
  check('latest call selected (Follow latest)', r[0].selected, r);
  check('URL decoded: %5B shown as [', r.some(x => x.path === '/api/orders?filter[status]=open'), r);
  const fail = r.find(x => x.status === '500');
  check('⏱ on a 500 opens the Exception panel', /\/_profiler\/tok\d+\?panel=exception$/.test(fail?.prof), fail);
  check('no ⏱ without X-Debug-Token', r.find(x => x.path === '/api/plain')?.prof === null, r);
  const theme = await cdp.evaluate(panelS, `document.documentElement.dataset.theme`);
  check('theme follows DevTools', theme === 'light' || theme === 'dark', theme);

  // 3. Detail of GET /api/orders.
  await click(row(`r.querySelector('.method').textContent === 'GET' && r.title.endsWith('/api/orders')`));
  let d = await settle(async () => {
    const v = await detail();
    return /\?panel=core\.performance$/.test(v.links.find(l => l[0] === 'Performance')?.[1]) && v;
  }, 'core.performance link') || await detail();
  check('Response tab shows the JSON tree', d.tab === 'Response' && /total: 2/.test(d.body) && /items: Array\(2\)/.test(d.body), d);
  check('profiler buttons on a 200', d.links.map(l => l[0]).join() === 'Profiler ↗,Doctrine,Logs,Performance,Request', d.links);
  check('Performance links the custom panel found in the profiler menu',
    /\/_profiler\/tok\d+\?panel=core\.performance$/.test(d.links.find(l => l[0] === 'Performance')?.[1]), d.links);

  // 4. Payload and Headers tabs of the POST.
  await click(row(`r.querySelector('.method').textContent === 'POST'`));
  await click(tab('Payload'));
  d = await detail();
  check('Payload tab shows the request body', /Request body/.test(d.body) && /name: "Foo"/.test(d.body), d.body);
  await click(tab('Headers'));
  const highlighted = await cdp.evaluate(panelS, `[...document.querySelectorAll('tr.highlight td:first-child')].map(td => td.textContent.toLowerCase())`);
  check('Headers tab highlights X-Debug-Token*', highlighted.includes('x-debug-token') && highlighted.includes('x-debug-token-link'), highlighted);
  await click(tab('Response'));

  // 5. Detail of the 500.
  await click(row(`r.querySelector('.status').textContent === '500'`));
  d = await detail();
  check('Exception button on a 500', d.links.some(l => l[0] === 'Exception' && l[1].endsWith('?panel=exception')), d.links);
  // Several details rendered since the first one: the profiler menu was still read only once.
  check('one profiler menu lookup per origin', server.profilerHits.length === 1, server.profilerHits);

  // 6. Filter with several words, then clear it.
  const setFilter = v => cdp.evaluate(panelS, `(() => { const f = document.getElementById('filter'); f.value = ${JSON.stringify(v)}; f.dispatchEvent(new Event('input')); })()`);
  await setFilter('post 201');
  r = await rows();
  check('filter "post 201" keeps the POST only', r.length === 1 && r[0].method === 'POST', r);
  await setFilter('');

  // 7. Keyboard: ArrowDown moves the selection.
  const before = (await rows()).findIndex(x => x.selected);
  await cdp.evaluate(panelS, `document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))`);
  const after = (await rows()).findIndex(x => x.selected);
  check('ArrowDown selects the next row', after === before + 1, { before, after });

  // 8. A call made while the panel is open lands on top, selected.
  await cdp.evaluate(pageS, `fetch('/api/orders?page=2')`);
  r = await settle(async () => { const v = await rows(); return v[0]?.path === '/api/orders?page=2' && v; }, 'live row') || await rows();
  check('live call added on top and selected', r[0].path === '/api/orders?page=2' && r[0].selected, r.slice(0, 2));
  const count = await cdp.evaluate(panelS, `document.getElementById('count').textContent`);
  check('counter shows visible / total', /^6 \/ \d+$/.test(count), count);

  // 9. Unchecking XHR/fetch only shows the image.
  await click(`document.getElementById('xhrOnly')`);
  r = await rows();
  check('unchecking XHR/fetch only shows the image', r.some(x => x.path === '/img.png'), r.map(x => x.path));
  await click(`document.getElementById('xhrOnly')`);

  // 10. Latest profiler opens the profiler in a tab.
  await click(`document.getElementById('latestProfiler')`);
  const opened = await settle(() => find(/\/_profiler\/tok\d+$/), 'profiler tab');
  check('Latest profiler ↗ opens the profiler in a tab', opened, 'no /_profiler/ tab');

  // 11. A profiler without a custom performance panel keeps Symfony's 'time' panel.
  await cdp.evaluate(pageS, `fetch(${JSON.stringify(`${plain.base}/api/orders`)})`);
  await waitFor(async () => (await rows())[0]?.selected && (await detail()).url === `${plain.base}/api/orders`, 'second API row');
  await settle(() => plain.profilerHits.length > 0, 'second profiler lookup');
  await sleep(300); // leaves time for a wrong upgrade of the link to show
  d = await detail();
  check('Performance falls back to time without a custom panel',
    new RegExp(`^${plain.base}/index\\.php/_profiler/tok\\d+\\?panel=time$`).test(d.links.find(l => l[0] === 'Performance')?.[1]),
    { links: d.links, hits: plain.profilerHits });

  // Screenshot of DevTools on the Symfony tab, before a navigation empties the list.
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, dtS);
  writeFileSync(shot, Buffer.from(data, 'base64'));

  // 12. Navigation clears the list, unless Preserve log is checked.
  const reload = async () => {
    await cdp.evaluate(pageS, `window.__beforeReload = true`);
    await cdp.send('Page.reload', {}, pageS);
    await waitFor(async () => (await cdp.evaluate(pageS, `!window.__beforeReload && document.readyState === 'complete'`)), 'reload');
  };
  await reload();
  r = await settle(async () => { const v = await rows(); return v.length === 0 && v; }, 'empty list') || await rows();
  check('navigation clears the list', r.length === 0, r);
  await click(`document.getElementById('preserve')`);
  await cdp.evaluate(pageS, `fetch('/api/orders')`);
  await waitFor(async () => (await rows()).length === 1, 'preserved row');
  await reload();
  await sleep(500); // leaves time for onNavigated, which must not clear anything
  r = await rows();
  check('Preserve log keeps calls across navigation', r.length === 1, r);
} catch (e) {
  check('test ran to the end', false, e.message);
} finally {
  await cdp.stop();
  server.close();
  plain.close();
}

for (const c of results) {
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}`);
  if (!c.ok) console.log(`      ${JSON.stringify(c.detail)}`);
}
const failed = results.filter(c => !c.ok).length;
console.log(`\ne2e: ${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
