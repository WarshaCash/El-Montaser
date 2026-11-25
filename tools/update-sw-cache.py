#!/usr/bin/env python3
"""يعيد توليد قائمة الملفات المخزّنة مسبقاً في sw.js واسم الكاش (بصمة من محتوى الملفات).
شغّله بعد إضافة/حذف أي ملف CSS أو JS:   python tools/update-sw-cache.py
"""
import hashlib, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SW = os.path.join(ROOT, 'sw.js')
SKIP_ASSETS = {'assets/icon-512.png', 'assets/icon-maskable-512.png', 'assets/apple-touch-icon.png'}  # للتثبيت فقط

def walk(folder):
    for base, _, files in os.walk(os.path.join(ROOT, folder)):
        for f in files:
            yield os.path.relpath(os.path.join(base, f), ROOT).replace(os.sep, '/')

files = ['./', 'index.html', 'manifest.webmanifest']
files += sorted(walk('css')) + sorted(walk('js'))
files += sorted(p for p in walk('assets') if p not in SKIP_ASSETS)

h = hashlib.sha1()
for p in files:
    if p != './':
        h.update(p.encode()); h.update(open(os.path.join(ROOT, p), 'rb').read())
version = h.hexdigest()[:8]

body = ',\n'.join(f"  '{p}'" for p in files)
src = open(SW, encoding='utf-8').read()
src, n1 = re.subn(r"const CACHE = '[^']*';", f"const CACHE = 'almontaser-shell-{version}';", src)
src, n2 = re.subn(r"// <precache:start>.*?// <precache:end>", f"// <precache:start>\nconst SHELL = [\n{body},\n];\n// <precache:end>", src, flags=re.S)
if not (n1 and n2):
    sys.exit('sw.js لا يحتوي علامات <precache:start/end> أو ثابت CACHE')
open(SW, 'w', encoding='utf-8').write(src)
print(f'sw.js محدَّث: {len(files)} ملفاً في الكاش، الإصدار {version}')
