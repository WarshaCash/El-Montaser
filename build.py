#!/usr/bin/env python3
"""يجمّع وحدات js/ في js/bundle.js (سكربت عادي) ليعمل index.html بالفتح المباشر file:// دون خادم.

شغّله بعد أي تعديل على الملفات:  python3 build.py

قواعد الكتابة التي يفهمها المجمّع (التزم بها في كل وحدة):
  - الاستيراد بصيغة مسماة فقط:  import { a, b } from '../core/dom.js';
  - التصدير بصيغة:  export const|let|function|class ...   أو   export { a, b };
  - لا import ديناميكي ولا default exports.
"""
import base64
import json
import os
import re

ROOT = os.path.dirname(os.path.abspath(__file__))
JS = os.path.join(ROOT, 'js')
ASSETS_OUT = os.path.join(JS, 'infrastructure', 'assets')

IMPORT = re.compile(r"import\s*\{([^}]*)\}\s*from\s*'([^']+)';?")
EXPORT_LIST = re.compile(r"export\s*\{([^}]*)\};?")
EXPORT_DECL = re.compile(r"export\s+((?:async\s+)?(?:function\*?|const|let|class)\s+(\w+))")


def read(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)


def data_uri(path, mime):
    return f'data:{mime};base64,' + base64.b64encode(open(path, 'rb').read()).decode()


# ---------- 1) الأصول المضمّنة (الشعار والأيقونات) ----------
def generate_assets():
    logo = os.path.join(ROOT, 'assets', 'logo.webp')
    logo_data = data_uri(logo, 'image/webp') if os.path.exists(logo) else ''
    write(os.path.join(ASSETS_OUT, 'logoData.js'),
          "// مولَّد من build.py: الشعار كبيانات مضمّنة لتوليد ملف PDF\n"
          f"export const LOGO_DATA = '{logo_data}';\n")

    icons = {}
    icons_dir = os.path.join(ROOT, 'assets', 'icons')
    if os.path.isdir(icons_dir):
        for name in sorted(os.listdir(icons_dir)):
            if name.endswith('.webp'):
                icons[name[:-5]] = data_uri(os.path.join(icons_dir, name), 'image/webp')
        for name in sorted(os.listdir(icons_dir)):  # SVG يتقدّم على WEBP لنفس الاسم
            if name.endswith('.svg'):
                icons[name[:-4]] = data_uri(os.path.join(icons_dir, name), 'image/svg+xml')
    write(os.path.join(ASSETS_OUT, 'iconsData.js'),
          "// مولَّد من build.py: أيقونات التواصل (اتصال/واتساب/فودافون كاش/إنستاباي) كبيانات مضمّنة\n"
          f"export const ICONS = {json.dumps(icons)};\n")


# ---------- 2) اكتشاف الوحدات وترتيب التبعيات ----------
def module_key(path):
    """مفتاح الوحدة = مسارها النسبي داخل js/ بلا الامتداد، مثل core/dom."""
    return os.path.relpath(path, JS)[:-3].replace(os.sep, '/')


def resolve_import(importer_path, spec):
    return module_key(os.path.normpath(os.path.join(os.path.dirname(importer_path), spec)))


def discover_modules():
    modules = {}
    for folder, _, names in os.walk(JS):
        for name in names:
            if name.endswith('.js') and name != 'bundle.js':
                path = os.path.join(folder, name)
                modules[module_key(path)] = path
    return modules


def dependency_order(modules, entry='app'):
    order, seen = [], set()

    def visit(key):
        if key in seen:
            return
        seen.add(key)
        path = modules[key]
        for _, spec in IMPORT.findall(read(path)):
            visit(resolve_import(path, spec))
        order.append(key)

    visit(entry)
    return order


# ---------- 3) تحويل الوحدة إلى دالة فورية داخل الحزمة ----------
def inject_sync_config(source):
    """يحقن رابط السكربت والرمز السري من متغيرات البيئة وقت البناء (إن وُجدت) بدل كتابتهما في المستودع."""
    for env, field in (('WORKSHOP_SYNC_URL', 'scriptUrl'), ('WORKSHOP_SYNC_TOKEN', 'token')):
        value = os.environ.get(env)
        if value:
            source = re.sub(rf"({field}: )'[^']*'", lambda m: f"{m.group(1)}{json.dumps(value)}", source)
    return source


def wrap_module(key, path):
    source, exported = read(path), []
    if key == 'config/syncConfig':
        source = inject_sync_config(source)

    def replace_import(m):
        names = m.group(1).strip()
        return f"const {{{names}}} = __m[{json.dumps(resolve_import(path, m.group(2)))}];"

    def collect_list(m):
        exported.extend(n.strip() for n in m.group(1).split(',') if n.strip())
        return ''

    def collect_decl(m):
        exported.append(m.group(2))
        return m.group(1)

    source = IMPORT.sub(replace_import, source)
    source = EXPORT_LIST.sub(collect_list, source)
    source = EXPORT_DECL.sub(collect_decl, source)
    return f"__m[{json.dumps(key)}] = (() => {{\n{source}\nreturn {{{', '.join(exported)}}};\n}})();"


def build():
    generate_assets()
    modules = discover_modules()
    order = dependency_order(modules)
    parts = ["/* ملف مولَّد من build.py — لا تعدّله يدوياً */", "(() => { 'use strict'; const __m = {};"]
    parts += [wrap_module(key, modules[key]) for key in order]
    parts.append("})();")
    write(os.path.join(JS, 'bundle.js'), '\n'.join(parts))
    print(f'bundle: {len(order)} modules')


if __name__ == '__main__':
    build()
