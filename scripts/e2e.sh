#!/usr/bin/env bash
# End-to-end test in a real DevTools: loads the extension in Chrome for Testing and drives it
# against a fake Symfony API. Saves a screenshot of the Symfony tab to dist/e2e.png.
# Usage: scripts/e2e.sh [extension dir or zip] [headed]   (default: this folder)
#
# Needs Node.js 22+ and Chrome for Testing: Google Chrome ignores --load-extension since
# version 137. Install it once with
#   npx @puppeteer/browsers@3.2.3 install chrome@stable --path ~/.cache/puppeteer
# or give the binary in E2E_CHROME.
set -euo pipefail
cd "$(dirname "$0")/.."

src=${1:-.}
mode=${2:-}

chrome=${E2E_CHROME:-$(find "$HOME/.cache/puppeteer/chrome" -type f \
  \( -path '*/MacOS/Google Chrome for Testing' -o -path '*/chrome-linux64/chrome' \) 2>/dev/null \
  | sort -V | tail -1)}
if [ -z "$chrome" ] || [ ! -x "$chrome" ]; then
  echo "Chrome for Testing not found. Install it with:" >&2
  echo "  npx @puppeteer/browsers@3.2.3 install chrome@stable --path ~/.cache/puppeteer" >&2
  exit 1
fi

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
if [ -f "$src" ]; then
  unzip -q "$src" -d "$tmp/ext"
  ext="$tmp/ext"
else
  ext=$(cd "$src" && pwd)
fi

mkdir -p dist
echo "chrome: $("$chrome" --version)"
echo "extension: $src"
node tests/e2e/run.mjs "$chrome" "$ext" dist/e2e.png $mode
echo "screenshot: dist/e2e.png"
