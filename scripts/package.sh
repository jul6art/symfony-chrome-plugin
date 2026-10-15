#!/usr/bin/env bash
# Builds dist/symfony-chrome-plugin-<version>.zip, ready for the Chrome Web Store or a manual install.
set -euo pipefail
cd "$(dirname "$0")/.."

version=$(node -p 'require("./manifest.json").version')
out="dist/symfony-chrome-plugin-${version}.zip"

mkdir -p dist
rm -f "$out"
zip -q "$out" manifest.json *.html *.js *.css LICENSE icons/*.png
echo "$out"
