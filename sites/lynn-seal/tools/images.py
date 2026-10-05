"""Generate WebP variants for every JPEG under assets/. Run: python3 tools/images.py
Writes name.webp (same size, q80) and name-480.webp (480px wide) next to each source."""
import os, sys
from PIL import Image
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets')
made = 0
for dirpath, _, files in os.walk(root):
    if 'vendor' in dirpath: continue
    for f in files:
        if not f.lower().endswith(('.jpg', '.jpeg')) or f.endswith('-480.jpg'): continue
        src = os.path.join(dirpath, f); base = os.path.splitext(src)[0]
        im = Image.open(src).convert('RGB')
        for suffix, width in (('', None), ('-480', 480)):
            out = base + suffix + '.webp'
            if os.path.exists(out) and os.path.getmtime(out) >= os.path.getmtime(src): continue
            target = im if (width is None or im.width <= width) else im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
            target.save(out, 'WEBP', quality=80, method=6); made += 1
print('webp files written:', made)
