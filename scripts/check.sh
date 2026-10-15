#!/usr/bin/env bash
# Static checks run by CI and before each commit. Needs Node.js only.
set -euo pipefail
cd "$(dirname "$0")/.."

for f in *.js; do
  node --check "$f"
done

node -e '
const fs = require("fs");
const m = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
if (m.manifest_version !== 3) throw new Error("manifest_version must be 3");
if (!/^\d+(\.\d+){0,3}$/.test(m.version)) throw new Error(`invalid version: ${m.version}`);
for (const page of [m.devtools_page, "panel.html", ...Object.values(m.icons || {})]) {
  if (!fs.existsSync(page)) throw new Error(`missing ${page}`);
}
// MV3 extension pages refuse inline scripts, so every <script> must have a src.
for (const page of fs.readdirSync(".").filter(f => f.endsWith(".html"))) {
  if (/<script(?![^>]*\ssrc=)[^>]*>/i.test(fs.readFileSync(page, "utf8"))) {
    throw new Error(`${page}: inline <script> is blocked by the extension CSP`);
  }
}
'

echo "check: OK"
