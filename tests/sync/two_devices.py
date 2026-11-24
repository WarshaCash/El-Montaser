"""تجربة أجهزة حقيقية على نفس الشيت الوهمي:  python3 tests/sync/two_devices.py
الإعداد داخل الكود: السكربت ينسخ المشروع لمجلد مؤقت ويكتب فيه رابط الخادم الوهمي والرمز داخل config/syncConfig.js
ثم يبني الحزمة (بالضبط كما سيفعل المبرمج). يحتاج playwright لبايثون وNode."""
import json, pathlib, re, shutil, subprocess, sys, tempfile, time, urllib.request
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
URL, TOKEN, PORT = 'http://localhost:8787', 'secret-token', 8787
ok = True
def check(name, cond, extra=''):
    global ok; ok = ok and bool(cond); print(('PASS ' if cond else 'FAIL ') + name, extra if not cond else '')

def make_build(token, url=URL):
    """نسخة من المشروع بإعداد المزامنة مكتوباً في الكود (token/url فارغان = وضع محلي)."""
    dest = pathlib.Path(tempfile.mkdtemp(prefix='workshop-')) / 'app'
    shutil.copytree(ROOT, dest, ignore=shutil.ignore_patterns('tests', '.git', 'node_modules', '__pycache__', 'bundle.js'))
    set_config(dest, token, url)
    return dest

def set_config(dest, token, url=URL):
    f = dest / 'js/config/syncConfig.js'
    src = f.read_text(encoding='utf-8')
    src = re.sub(r"scriptUrl: '[^']*'", f"scriptUrl: '{url if token else ''}'", src)
    src = re.sub(r"token: '[^']*'", f"token: '{token}'", src)
    f.write_text(src, encoding='utf-8')
    subprocess.run([sys.executable, 'build.py'], cwd=dest, check=True, stdout=subprocess.DEVNULL)

server = subprocess.Popen(['node', str(ROOT / 'tests/sync/mockServer.mjs'), str(PORT), '300'], stdout=subprocess.PIPE)
time.sleep(1)
hits = lambda: json.load(urllib.request.urlopen(URL + '/__stats'))['hits']

def device(browser, build):
    ctx = browser.new_context(viewport={'width': 1280, 'height': 900})
    page = ctx.new_page(); errs = []
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.goto((build / 'index.html').as_uri() + '#/'); page.wait_for_timeout(1200)
    return ctx, page, errs

def badge(page): return page.locator('#syncbadge').inner_text() if page.locator('#syncbadge').is_visible() else ''
OUTBOX_COUNT = "() => new Promise((r) => { const o = indexedDB.open('workshopDB'); o.onsuccess = () => { const q = o.result.transaction('outbox').objectStore('outbox').count(); q.onsuccess = () => { o.result.close(); r(q.result); }; }; })"
def wait_saved(page, t=30):
    end = time.time() + t
    while time.time() < end:
        if page.evaluate(OUTBOX_COUNT) == 0 and badge(page).startswith('✓'): return
        page.wait_for_timeout(250)
    raise AssertionError('لم يفرغ صندوق الصادر: ' + badge(page))
def sync_now(page): page.evaluate("window.dispatchEvent(new Event('online'))")

def new_customer(page, name, phone):
    if not page.locator('.new-cust').is_visible():
        page.locator('select').filter(has=page.locator('option', has_text='＋ عميل جديد…')).first.select_option(label='＋ عميل جديد…')
    page.locator('.new-cust input').nth(0).fill(name); page.locator('.new-cust input').nth(1).fill(phone)

def invoice(page, name, phone, total):
    page.evaluate("h=>{location.hash=h}", '/invoices/new'); page.wait_for_selector('.cat-grid')
    page.locator('.cat-tile[data-v="جزامة"]').click(); page.wait_for_timeout(150)
    page.fill('.fields2 input.big-in', '100')
    new_customer(page, name, phone)
    page.click('.add-btn'); page.wait_for_timeout(150)
    page.fill('input[placeholder="الإجمالي بالجنيه"]', str(total))
    t0 = time.time(); page.click('button:has-text("حفظ الفاتورة")')
    page.wait_for_function("() => location.hash.startsWith('#/invoice?id=')")
    return time.time() - t0

def text_of(page, route):
    page.evaluate("h=>{location.hash=h}", route); page.wait_for_timeout(700); return page.locator('#view').inner_text()

good = make_build(TOKEN)
with sync_playwright() as p:
    br = p.chromium.launch()
    # ---- الجهاز A: لا شاشة دخول ولا حقول؛ حفظ فوري ثم وصول للشيت
    ca, A, ea = device(br, good)
    check('A: لا شاشة دخول', A.locator('.gate').count() == 0)
    check('A: شارة المزامنة ظاهرة', A.locator('#syncbadge').is_visible())
    took = invoice(A, 'عميل الجهاز أ', '01011111111', 4000)
    check(f'A: الحفظ فوري ولا ينتظر الشبكة ({took:.2f}s)', took < 1.5, took)
    wait_saved(A); check('A: وصلت البيانات للشيت (✓ محفوظ)', True)
    st = text_of(A, '/settings')
    check('الإعدادات بلا أي خانة مزامنة أو رابط أو رمز', 'Google Sheets' not in st and 'الرمز السري' not in st and 'رابط السكربت' not in st)
    # ---- الجهاز B: جديد، يتصل تلقائياً ويرى بيانات أ بلا أي تدخل
    cb, B, eb = device(br, good); B.wait_for_timeout(1200)
    check('B: لا شاشة دخول ولا إدخال رمز', B.locator('.gate').count() == 0 and B.locator('input[type=password]').count() == 0)
    check('B: يرى عميل أ تلقائياً', 'عميل الجهاز أ' in text_of(B, '/customers'))
    check('B: يرى فاتورة أ', '4,000' in text_of(B, '/invoices'))
    invoice(B, 'عميل الجهاز ب', '01022222222', 2500); wait_saved(B)
    sync_now(A); A.wait_for_timeout(1500)
    check('A: استقبل عميل ب تلقائياً', 'عميل الجهاز ب' in text_of(A, '/customers'))
    # ---- انقطاع الإنترنت
    ca.set_offline(True)
    invoice(A, 'عميل بدون نت', '01033333333', 900); A.wait_for_timeout(1500)
    check('A: يعمل بدون إنترنت ويُظهر المعلّق', 'بلا إنترنت' in badge(A) or 'تعذّر' in badge(A), badge(A))
    ca.set_offline(False); sync_now(A); wait_saved(A, 30)
    sync_now(B); B.wait_for_timeout(1500)
    check('B: استقبل ما كُتب أثناء انقطاع A', 'عميل بدون نت' in text_of(B, '/customers'))
    h0 = hits(); A.wait_for_timeout(3000); check('لا طلبات زائدة وقت الخمول', hits() - h0 <= 1, hits() - h0)
    # ---- جهاز عليه بيانات محلية قديمة ثم يُضبط الكود للمزامنة: دمج تلقائي بلا فقدان وبلا أسئلة
    legacy = make_build('')                      # نسخة محلية بلا مزامنة
    cc = br.new_context(); C = cc.new_page(); C.goto((legacy / 'index.html').as_uri() + '#/'); C.wait_for_timeout(600)
    check('C (محلي): لا شارة مزامنة', not C.locator('#syncbadge').is_visible())
    invoice(C, 'بيانات محلية قديمة', '01044444444', 100)
    set_config(legacy, TOKEN); C.reload(); C.wait_for_timeout(2500)
    ctext = text_of(C, '/customers')
    check('C: بعد الربط صار عنده بيانات الشيت وبقيت بياناته المحلية (دمج)', all(s in ctext for s in ('عميل الجهاز أ', 'عميل الجهاز ب', 'بيانات محلية قديمة')), ctext[:150])
    wait_saved(C); sync_now(B); B.wait_for_timeout(1500)
    check('B: استقبل بيانات C المحلية القديمة', 'بيانات محلية قديمة' in text_of(B, '/customers'))
    # ---- رمز خاطئ في الكود: لا يُطلب من المدير شيء، وتظهر رسالة تحيله للمبرمج
    bad = make_build('wrong-token')
    cd, D, ed = device(br, bad); D.wait_for_timeout(1500)
    check('D: رمز خاطئ → الشارة تحيل للمبرمج بلا نموذج إدخال', 'المبرمج' in badge(D) and D.locator('input[type=password]').count() == 0, badge(D))
    print('errors:', ea, eb, ed)
    check('بلا أخطاء JS', not ea and not eb)
    br.close()
server.terminate()
print('\nكل التجارب نجحت' if ok else '\nفيه فشل'); sys.exit(0 if ok else 1)
