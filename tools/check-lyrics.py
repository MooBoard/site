"""Self-check: every lyric line in every timing file gets lit during playback.

Mirrors the board's rules (js/board.js S.song + js/music.js loadTiming): lines show in pairs (top, bottom); the
current line is the first whose end (the next line's start) is still ahead; a word lights once playback passes its
t0. A line passes if one of its words starts while its pair is on the board.
Run:  python3 tools/check-lyrics.py        (exit 1 on any unlit line)
"""
import json, glob, os, sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bad = 0
for f in sorted(glob.glob(os.path.join(root, 'music', 'archive', '*.timing.json'))):
    j = json.load(open(f))
    off = j.get('offsetMs', 0) / 1000
    L = [l for l in j['lines'] if l.get('words')]
    for l in L:
        l['t0'] = l['words'][0]['t0'] + off
    for i, l in enumerate(L):
        l['t1'] = L[i + 1]['t0'] if i + 1 < len(L) else l['words'][-1]['t1'] + off + .6
    length = j.get('length') or L[-1]['t1']
    for i, l in enumerate(L):
        top = i - i % 2
        shown_from = L[top - 1]['t1'] if top > 0 else 0
        last = L[top + 1] if top + 1 < len(L) else L[top]
        shown_to = min(last['t1'] if last is not L[-1] else length, length)
        lit = any(shown_from <= w['t0'] + off < shown_to for w in l['words'])
        if not lit:
            bad += 1
            print('UNLIT %s line %d (%.2f-%.2f shown %.2f-%.2f)' % (os.path.basename(f), i + 1, l['t0'], l['t1'], shown_from, shown_to))
    print('%-22s %d lines ok' % (os.path.basename(f), len(L)) if not bad else '')
sys.exit(1 if bad else 0)
