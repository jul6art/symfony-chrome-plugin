#!/usr/bin/env bash
# Regenerates the extension icons and the Chrome Web Store images from their sources:
# icons/icon.svg, store/promo.html, and the panel rendered with tests/mock-store.js.
# Needs Google Chrome; on a system other than macOS, give its path in CHROME.
set -euo pipefail
cd "$(dirname "$0")/.."

chrome=${CHROME:-"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"}
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# shot <url> <width> <height> <output.png>, on a transparent background.
shot() {
  "$chrome" --headless=new --user-data-dir="$tmp/profile" --allow-file-access-from-files \
    --hide-scrollbars --force-device-scale-factor=1 --default-background-color=00000000 \
    --window-size="$2,$3" --screenshot="$4" "$1" >/dev/null 2>&1
  echo "$4"
}

# At 128 px, Chrome wants a 96 px drawing with 16 px of transparent padding.
# The small sizes use the whole square.
for size in 16 32 48 128; do
  pad=$(( size == 128 ? 16 : 0 ))
  cat > "$tmp/icon-$size.html" <<EOF
<!doctype html><style>html,body{margin:0;background:transparent}</style>
<img src="file://$PWD/icons/icon.svg" style="display:block;width:$(( size - 2 * pad ))px;margin:${pad}px">
EOF
  shot "file://$tmp/icon-$size.html" "$size" "$size" "icons/icon-$size.png"
done

shot "file://$PWD/store/promo.html" 440 280 store/promo-440x280.png

for theme in dark light; do
  WINDOW=1280,800 scripts/render.sh "$theme" "store/screenshot-$theme-1280x800.png" | head -1
done
