// Uploads a packaged zip to the Chrome Web Store and submits it for review, with the Chrome Web
// Store API v2 and a service account. Run by the CI on version tags, once the store is set up
// (see store/listing.md). Needs Node.js 18+ and no package.
//
// Usage: node scripts/publish-store.mjs <zip>
// Environment: CWS_SERVICE_ACCOUNT_KEY (the service account's JSON key), CWS_PUBLISHER_ID,
// CWS_EXTENSION_ID.
import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const [zip] = process.argv.slice(2);
const { CWS_SERVICE_ACCOUNT_KEY: key, CWS_PUBLISHER_ID: publisher, CWS_EXTENSION_ID: item } = process.env;
if (!zip || !key || !publisher || !item) {
  console.error('Usage: CWS_SERVICE_ACCOUNT_KEY=… CWS_PUBLISHER_ID=… CWS_EXTENSION_ID=… node scripts/publish-store.mjs <zip>');
  process.exit(2);
}

const API = `https://chromewebstore.googleapis.com/v2/publishers/${publisher}/items/${item}`;
const UPLOAD = `https://chromewebstore.googleapis.com/upload/v2/publishers/${publisher}/items/${item}:upload`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const base64url = text => Buffer.from(text).toString('base64url');

// Service account flow: a JWT signed with the account's private key, exchanged for an access token.
async function accessToken() {
  const { client_email, private_key } = JSON.parse(key);
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64url(JSON.stringify({
    iss: client_email,
    scope: 'https://www.googleapis.com/auth/chromewebstore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 600,
  }))}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(private_key, 'base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`access token: HTTP ${res.status} ${JSON.stringify(body)}`);
  return body.access_token;
}

async function call(token, url, init = {}) {
  const res = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${url.split(':').pop()}: HTTP ${res.status} ${text}`);
  return text ? JSON.parse(text) : {};
}

const token = await accessToken();

const uploaded = await call(token, UPLOAD, {
  method: 'POST',
  headers: { 'Content-Type': 'application/zip' },
  body: readFileSync(zip),
});
console.log('upload:', JSON.stringify(uploaded));

// A large package is processed asynchronously: poll until it is done.
let state = uploaded.uploadState;
for (let i = 0; i < 24 && /IN_PROGRESS/.test(state); i++) {
  await sleep(5000);
  state = (await call(token, `${API}:fetchStatus`)).lastAsyncUploadState;
  console.log('upload state:', state);
}
// The store refuses a package whose version is not higher than the published one.
if (state !== 'SUCCEEDED') throw new Error(`upload ended in state ${state}`);

const published = await call(token, `${API}:publish`, { method: 'POST' });
console.log('publish:', JSON.stringify(published));
console.log('Submitted for review. Track it in the Chrome Web Store Developer Dashboard.');
