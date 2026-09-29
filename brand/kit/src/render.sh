#!/bin/zsh
# render.sh in.svg out.png size
cd ${0:a:h}
cat > _r.html <<H
<html><body style="margin:0;background:transparent"><img src="file://$1" style="width:$3px;height:$3px;display:block"></body></html>
H
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --force-device-scale-factor=1 --default-background-color=00000000 --window-size=$3,$3 --screenshot=$2 file://$PWD/_r.html 2>/dev/null >/dev/null
rm _r.html
