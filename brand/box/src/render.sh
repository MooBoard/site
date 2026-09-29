#!/bin/sh
# Render helper: render.sh <html> <png> <w> <h> [scale]
C="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$C" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=${5:-1} --window-size=$3,$4 --screenshot="$2" "file://$1" 2>/dev/null
