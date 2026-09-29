import re, os
B = os.path.expanduser('~/.pixelwall-build/mooboard-site/brand')
K = B + '/kit'
def inner(name):
    s = open(f'{B}/{name}').read()
    return re.sub(r'^\s*<svg[^>]*>|</svg>\s*$', '', s.strip()).strip()
MARK = {c: inner(f'mark-{c}.svg') for c in ['sky','black','white','orange','teal']}
SKY='#3DC4E0'
def placed(markinner, cx, cy, s):
    # the pixel mark: a 20 x 16 dot grid, centre (10, 8); s is the old smooth mark's scale, so the pixel mark
    # keeps the same visual size (the smooth mark was ~132 units wide, the grid is 20)
    k = s * 6.6
    return f'<g transform="translate({cx-10*k:.2f},{cy-8*k:.2f}) scale({k:.4f})">{markinner}</g>'
def svg(w,h,body): return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">{body}</svg>\n'
glow = '<defs><radialGradient id="g" cx="50%" cy="42%" r="70%"><stop offset="0" stop-color="#6ED6EA"/><stop offset="1" stop-color="#3DC4E0"/></radialGradient></defs>'
# App icon, full bleed
open(f'{K}/app-icon.svg','w').write(svg(1024,1024, glow+'<rect width="1024" height="1024" fill="url(#g)"/>'+placed(MARK['white'],512,530,5.1)))
# iOS rounded preview (squircle-ish: rx 22.4%)
open(f'{K}/app-icon-ios.svg','w').write(svg(1024,1024, glow+'<rect width="1024" height="1024" rx="229" fill="url(#g)"/>'+placed(MARK['white'],512,530,5.1)))
# Android adaptive foreground 432 (safe zone 264 diameter circle centred)
open(f'{K}/app-icon-android-foreground.svg','w').write(svg(432,432, placed(MARK['white'],216,222,1.72)))
open(f'{K}/app-icon-android-background.svg','w').write(svg(432,432, f'<rect width="432" height="432" fill="{SKY}"/>'))
# Avatar 800, circle safe
open(f'{K}/avatar.svg','w').write(svg(800,800, f'<rect width="800" height="800" fill="{SKY}"/>'+placed(MARK['white'],400,414,3.9)))
# Favicon: simplified mark for tiny sizes
fav = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
<rect x="10" y="2.5" width="2.6" height="5" rx="1.3" fill="#F5E9D6"/><rect x="19.4" y="2.5" width="2.6" height="5" rx="1.3" fill="#F5E9D6"/>
<ellipse cx="3.6" cy="11.5" rx="3.4" ry="1.9" fill="#3DC4E0"/><ellipse cx="28.4" cy="11.5" rx="3.4" ry="1.9" fill="#3DC4E0"/>
<rect x="4" y="6" width="24" height="21" rx="6.5" fill="#3DC4E0"/>
<rect x="7" y="9" width="18" height="15" rx="4" fill="#0E1A22"/>
<rect x="9.5" y="11.5" width="5" height="5" rx="1.2" fill="#FFFFFF"/><rect x="17.5" y="11.5" width="5" height="5" rx="1.2" fill="#FFFFFF"/><rect x="11" y="13" width="2" height="2" rx="1" fill="#0E1A22"/><rect x="19" y="13" width="2" height="2" rx="1" fill="#0E1A22"/>
<rect x="10" y="18" width="12" height="5" rx="2.5" fill="#FFB7C9"/><rect x="13" y="20" width="2" height="2" rx="1" fill="#0E1A22"/><rect x="17" y="20" width="2" height="2" rx="1" fill="#0E1A22"/>
</svg>
'''
open(f'{K}/favicon.svg','w').write(fav)
