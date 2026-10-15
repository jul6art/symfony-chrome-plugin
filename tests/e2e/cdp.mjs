// Starts Chrome with the extension and DevTools open, and talks to it over the DevTools protocol.
// Needs Node.js 22+ for the global WebSocket.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function launch({ chrome, ext, url, headless = true }) {
  const profile = mkdtempSync(join(tmpdir(), 'symfony-chrome-plugin-e2e-'));
  const args = [
    `--user-data-dir=${profile}`, '--remote-debugging-port=0',
    `--load-extension=${ext}`, `--disable-extensions-except=${ext}`,
    '--auto-open-devtools-for-tabs', '--no-first-run', '--no-default-browser-check',
    '--window-size=1400,900',
    // GitHub's Ubuntu runners block the user namespaces Chrome's sandbox needs.
    // The test only loads its own localhost pages.
    ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
    ...(headless ? ['--headless=new'] : []),
    url,
  ];
  const proc = spawn(chrome, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  proc.stderr.on('data', d => (stderr += d));
  const exited = new Promise(r => proc.once('exit', r));

  // With --remote-debugging-port=0, Chrome writes the port it picked into the profile.
  let wsUrl;
  for (let i = 0; i < 100 && !wsUrl; i++) {
    await sleep(200);
    try {
      const [port, path] = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n');
      if (port && path) wsUrl = `ws://127.0.0.1:${port}${path}`;
    } catch {}
  }
  // Browser.close shuts Chrome down with its helper processes; a bare kill can leave helpers
  // writing to the profile. kill stays as the fallback.
  const stop = async close => {
    if (close) await Promise.race([close().catch(() => {}), sleep(3000)]);
    if (await Promise.race([exited.then(() => true), sleep(close ? 5000 : 0)]) !== true) {
      proc.kill();
      await Promise.race([exited, sleep(5000)]);
    }
    // A leftover temp folder must not fail the test.
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    } catch (e) {
      console.warn(`warning: could not remove ${profile}: ${e.message}`);
    }
  };
  if (!wsUrl) {
    await stop();
    throw new Error(`Chrome did not start\n${stderr}`);
  }
  const cdp = await connect(wsUrl);
  return { ...cdp, stop: () => stop(() => cdp.send('Browser.close')) };
}

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((ok, ko) => { ws.onopen = ok; ws.onerror = ko; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    if (!msg.id || !pending.has(msg.id)) return;
    const { ok, ko, method } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? ko(new Error(`${method}: ${msg.error.message}`)) : ok(msg.result);
  };
  const send = (method, params = {}, sessionId) => new Promise((ok, ko) => {
    const mid = ++id;
    pending.set(mid, { ok, ko, method });
    ws.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  return {
    send,
    async targets() { return (await send('Target.getTargets')).targetInfos; },
    async attach(targetId) { return (await send('Target.attachToTarget', { targetId, flatten: true })).sessionId; },
    async evaluate(sessionId, expression) {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    },
  };
}
