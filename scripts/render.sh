#!/usr/bin/env bash
# Renders panel.html in headless Chrome with tests/mock-store.js and saves a screenshot.
# Usage: scripts/render.sh [light|dark] [output.png]
set -euo pipefail
cd "$(dirname "$0")/.."

theme=${1:-dark}
shot=${2:-dist/render-${theme}.png}
chrome=${CHROME:-"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"}

tmp=$(mktemp -d)
# The fixture lives next to the real files so relative paths keep working.
fixture="render-fixture.html"
trap 'rm -rf "$tmp" "$fixture"' EXIT
sed 's#<script src="panel.js"></script>#<script src="panel.js"></script><script src="tests/mock-store.js"></script>#' \
  panel.html > "$fixture"

url="file://$PWD/$fixture?theme=$theme"
flags=(--headless=new --user-data-dir="$tmp" --allow-file-access-from-files --window-size=1100,600)

mkdir -p "$(dirname "$shot")"
"$chrome" "${flags[@]}" --screenshot="$shot" "$url" >/dev/null 2>&1
title=$("$chrome" "${flags[@]}" --dump-dom "$url" 2>/dev/null | sed -n 's#.*<title>\(.*\)</title>.*#\1#p')

echo "screenshot: $shot"
echo "result: ${title//&quot;/\"}"
