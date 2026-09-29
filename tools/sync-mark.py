"""Copy the MooBoard mark from brand/ into index.html (header + footer) as inline SVG,
grouped so the site can animate it: ears wiggle, eyes blink, pupils look and change colour.
Run after the mark changes:  python3 tools/sync-mark.py [teal|sky|black|white|orange]"""
import re, sys, os

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
variant = sys.argv[1] if len(sys.argv) > 1 else 'teal'
src = open(os.path.join(root, 'brand', 'mark-%s.svg' % variant)).read()
view = re.search(r'viewBox="([^"]+)"', src).group(1)
vx, vy, vw, vh = [float(v) for v in view.split()]
inner = re.sub(r'^.*?<svg[^>]*>|</svg>\s*$', '', src.strip(), flags=re.S)

def num(el, k):
    m = re.search(r'\b%s="([\d.]+)"' % k, el)
    return float(m.group(1)) if m else None

ear_l, ear_r, eyes, pupils, rest = [], [], [], [], []
for el in re.findall(r'<clipPath.*?</clipPath>|<g [^>]*>|</g>|<[^>]+/>', inner, flags=re.S):
    cx, cy = num(el, 'cx'), num(el, 'cy')
    if el.startswith('<ellipse') and cx is not None and cx < vw * .3:
        ear_l.append(el)
    elif el.startswith('<ellipse') and cx is not None and cx > vw * .7:
        ear_r.append(el)
    elif 'class="pupil"' in el:
        pupils.append(el)
    elif el.startswith('<circle') and 'fill="#FFFFFF"' in el and cy is not None and cy < vh * .6:
        eyes.append(el)
    else:
        rest.append(el)

def build(uid):
    body = ''.join(rest).replace('id="f"', 'id="%s"' % uid).replace('url(#f)', 'url(#%s)' % uid)
    # the eye dots and pupils live inside the screen's clip group, so close it before adding them
    if body.endswith('</g>'):
        body = body[:-4] + '<g class="eyes">' + ''.join(eyes) + '<g class="pupils">' + ''.join(pupils) + '</g></g></g>'
    else:
        body += '<g class="eyes">' + ''.join(eyes) + '<g class="pupils">' + ''.join(pupils) + '</g></g>'
    return ('<svg class="mark" viewBox="%s" aria-hidden="true"><g class="ear ear-l">%s</g><g class="ear ear-r">%s</g>%s</svg>'
            % (view, ''.join(ear_l), ''.join(ear_r), body))

path = os.path.join(root, 'index.html')
html = open(path).read()
n = [0]
def rep(m):
    n[0] += 1
    return m.group(1) + build('mclip%d' % n[0]) + m.group(3)
html = re.sub(r'(<!--mark-->)(.*?)(<!--/mark-->)', rep, html, flags=re.S)
open(path, 'w').write(html)
print('mark %s -> %d places' % (variant, n[0]))
