#!/usr/bin/env bash
# Renders scripts/og-image.html to public/og-image.png with headless Chrome,
# so the link preview image needs no image tools or npm packages.
#   apps/frontend/scripts/render-og-image.sh
# Set CHROME if Chrome lives somewhere else.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
chrome="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"

# The virtual time budget gives Google Fonts time to load before the shot.
"$chrome" --headless=new --disable-gpu --hide-scrollbars \
  --window-size=1200,630 --virtual-time-budget=5000 \
  --screenshot="$here/../public/og-image.png" \
  "file://$here/og-image.html"

echo "Wrote public/og-image.png"
