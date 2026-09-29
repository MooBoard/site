#!/bin/sh
# Fails if any audio or lyric file (or anything under local-music/) is tracked by git.
# Run before every commit:  sh tools/check-no-music.sh
bad=$(git ls-files | grep -iE '\.(mp3|m4a|aac|wav|flac|ogg|opus|lrc)$|^local-music/')
if [ -n "$bad" ]; then
  echo "These files must not be in git:"; echo "$bad"; exit 1
fi
echo "ok: no audio or lyric files tracked"
