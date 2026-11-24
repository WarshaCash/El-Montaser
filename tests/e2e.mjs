// اختبار دخان (E2E) في متصفح حقيقي: كل الشاشات تُفتح بلا أخطاء، وإضافة بند انتريه تعمل.
// التشغيل:  node tests/e2e.mjs        (يحتاج playwright + Chromium للتطوير فقط، لا يلزم لتشغيل النظام)
import { pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const url = pathToFileURL(resolve(root, 'index.html')).href;

const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${ok ? '' : extra}`); };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const problems = [];
page.on('pageerror', e => problems.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') problems.push('console: ' + m.text()); });


/** ينتظر حتى تُكتب قيمة إعداد في IndexedDB (بدل الاعتماد على التوقيت قبل إعادة التحميل). */
const waitForSetting = (key, value) => page.waitForFunction(([k, v]) => new Promise((resolve) => {
  const open = indexedDB.open('workshopDB');
  open.onsuccess = () => {
    const get = open.result.transaction('settings').objectStore('settings').get(k);
    get.onsuccess = () => { open.result.close(); resolve(get.result?.value === v); };
    get.onerror = () => resolve(false);
  };
  open.onerror = () => resolve(false);
}), [key, value]);

await page.goto(url);
await page.waitForSelector('#nav a');

const ROUTES = ['/', '/customers', '/archive', '/invoices', '/invoices/new', '/accounts', '/collect',
  '/treasury', '/settings'];
for (const r of ROUTES) {
  await page.evaluate(h => { location.hash = h; }, r);
  await page.waitForTimeout(250);
  const err = await page.locator('#view > p.err').count();
  check(`شاشة ${r} تُفتح بلا خطأ`, err === 0 && problems.length === 0, problems.join(' | '));
}

// ===== القائمة الجانبية: الترتيب، والروابط الفرعية، وتمييز الصفحة الحالية =====
const navTop = await page.locator('#nav > .nav-item > a').allInnerTexts();
check('القائمة الرئيسية بالترتيب الصحيح', JSON.stringify(navTop.map(t => t.trim())) === JSON.stringify(['الرئيسية', 'الفواتير', 'العملاء', 'الأرشيف', 'الحسابات', 'المصروفات', 'الخزينة', 'الإعدادات']), navTop.join('|'));
const settingsSub = await page.locator('#nav .nav-item:has(> a[data-path="/settings"]) .sub a').allInnerTexts();
check('الإعدادات فيها الإعدادات العامة فقط', JSON.stringify(settingsSub.map(t => t.trim())) === JSON.stringify(['الإعدادات العامة']), settingsSub.join('|'));
await page.evaluate(() => { location.hash = '/no-such-page'; });
await page.waitForTimeout(250);
check('مسار غير موجود يعرض رسالة بدل الانهيار', (await page.locator('#view').innerText()).includes('غير موجودة'));

// ===== سلوك شاشة الإعدادات: النسخ الاحتياطي والاستعادة والهوامش والخيارات =====
await page.evaluate(() => { location.hash = '/settings'; });
await page.waitForSelector('.card h3');
const restoreBtn = page.locator('button:has-text("استعادة (استبدال كامل)")');
check('الاستعادة معطّلة قبل أي نسخة', await restoreBtn.isDisabled());
const [download] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("إنشاء نسخة احتياطية الآن")')]);
const backupPath = await download.path();
await page.waitForFunction(() => document.body.innerText.includes('تم إنشاء النسخة'));
check('إنشاء نسخة احتياطية يعرض رسالة النجاح ويحدّث آخر نسخة', (await page.locator('#view').innerText()).includes('آخر نسخة احتياطية:'));
await page.setInputFiles('input[type=file]', backupPath);
await page.waitForSelector('#view ul li');
check('معاينة النسخة تعرض أعداد السجلات', (await page.locator('#view ul li').count()) >= 6);
check('الاستعادة تبقى معطّلة حتى يؤكّد المستخدم', await restoreBtn.isDisabled());
await page.check('label:has-text("أفهم أن البيانات الحالية ستُستبدل") input');
check('تؤكَّد الاستعادة بعد نسخة حالية + تأكيد صريح', !(await restoreBtn.isDisabled()));
await page.setInputFiles('input[type=file]', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"x":1}') });
await page.waitForFunction(() => document.body.innerText.includes('ملف مرفوض'));
check('ملف نسخة فاسد يُرفض وتبقى الاستعادة معطّلة', await restoreBtn.isDisabled());
await page.fill('label:has-text("الهامش العلوي") input', '1.5');
await page.click('.card:has(h3:has-text("ورق الفواتير")) button:has-text("حفظ")');
await page.waitForFunction(() => document.body.innerText.includes('تم حفظ إعدادات الطباعة'));
await page.fill('label:has-text("الهامش العلوي") input', '99');
await page.click('.card:has(h3:has-text("ورق الفواتير")) button:has-text("حفظ")');
await page.waitForFunction(() => document.body.innerText.includes('الهوامش بالسنتيمتر'));
check('هامش خارج الحدود يُرفض برسالة واضحة', true);
await page.fill('label:has-text("الهامش العلوي") input', '1.5');
await page.uncheck('label:has-text("حفظ نسخة PDF") input');
await page.check('label:has-text("ترقيم الصفحات") input');
await waitForSetting('autoPdf', false);
await waitForSetting('pageNumbers', true);
await page.reload();
await page.waitForSelector('.card h3');
check('الهامش المحفوظ يبقى بعد إعادة التحميل', (await page.inputValue('label:has-text("الهامش العلوي") input')) === '1.5');
check('خيارات الطباعة (PDF/ترقيم) تبقى بعد إعادة التحميل', !(await page.isChecked('label:has-text("حفظ نسخة PDF") input')) && (await page.isChecked('label:has-text("ترقيم الصفحات") input')));
await page.fill('label:has-text("تنبيه النسخ الاحتياطي بعد") input', '14');
await page.click('.card:has(h3:has-text("التذكير والتخزين")) button:has-text("حفظ")');
await page.waitForFunction(() => document.body.innerText.includes('تم الحفظ'));
await page.reload();
await page.waitForSelector('.card h3');
check('أيام تنبيه النسخ تُحفظ', (await page.inputValue('label:has-text("تنبيه النسخ الاحتياطي بعد") input')) === '14');

// ===== بند انتريه =====
await page.evaluate(() => { location.hash = '/invoices/new'; });
await page.waitForSelector('.cat-grid');
await page.click('.cat-tile[data-v="انتريه"]');
await page.waitForSelector('.fields2 .opt');
const optLabels = await page.locator('.fields2 .opt').allTextContents();
check('الانتريه: أزرار كنبة واحدة/كنبتان وكرسي واحد/كرسيان', ['كنبة واحدة', 'كنبتان', 'كرسي واحد', 'كرسيان'].every(x => optLabels.includes(x)), optLabels.join(','));
check('الافتراضي جاهز للإضافة (2 كنبة + 2 كرسي + ترابيزة)', (await page.locator('.stat').innerText()).includes('2 كنبة + 2 كرسي + ترابيزة'));
await page.click('.fields2 .opt:has-text("كنبة واحدة")');
await page.click('.fields2 .opt:has-text("كرسي واحد")');
check('الحالة تتبع الاختيار (1 كنبة + 1 كرسي + ترابيزة)', (await page.locator('.stat').innerText()).includes('1 كنبة + 1 كرسي + ترابيزة'));
await page.click('.add-btn');
await page.waitForTimeout(200);
const rows = await page.locator('table tbody tr td.pre').allTextContents();
check('البند أُضيف للقائمة بالوصف الصحيح', rows.some(t => t.includes('1 كنبة + 1 كرسي + ترابيزة')), rows.join('|'));

// ===== نوم (مشتملات) لا يتأثر =====
await page.click('.cat-tile[data-v="نوم"]');
await page.waitForSelector('.pick-head');
check('نوم: تظهر المشتملات', (await page.locator('.pick-head').count()) >= 5);
await page.click('.cat-tile[data-v="مطبخ"]');
check('مطبخ: عدّاد عدد الضلف', (await page.locator('.fields2 .stepper').count()) === 1);
await page.click('.cat-tile[data-v="جزامة"]');
check('جزامة: حقل مقاس واحد', (await page.locator('.fields2 input.big-in').count()) === 1);

// ===== حفظ فاتورة كاملة بعميل جديد ثم عرضها =====
page.on('dialog', (d) => d.accept());
await page.evaluate(() => { location.hash = '/invoices/new'; });
await page.waitForSelector('.cat-grid');
await page.fill('input[placeholder="اسم العميل"]', 'عميل اختبار');
await page.fill('input[placeholder="11 رقماً"]', '01012345678');
await page.click('.cat-tile[data-v="انتريه"]');
await page.click('.fields2 .opt:has-text("كنبتان")');
await page.click('.fields2 .opt:has-text("كرسي واحد")');
await page.click('.add-btn');
check('البند بلا سعر يُرفض', (await page.locator('.builder .err').innerText()).includes('اكتب سعر البند'));
await page.fill('input[placeholder="مثال: 50000"]', '15000');
await page.click('.add-btn');
check('إجمالي الفاتورة يُجمع تلقائياً (15000)', (await page.inputValue('input[placeholder="الإجمالي بالجنيه"]')) === '15000');
check('حقل الإجمالي للقراءة فقط', await page.locator('input[placeholder="الإجمالي بالجنيه"]').evaluate((e) => e.readOnly));
await page.click('button:has-text("حفظ الفاتورة")');
await page.waitForFunction(() => location.hash.startsWith('#/invoice?id='));
await page.waitForTimeout(500);
const view = await page.locator('#view').innerText();
check('الفاتورة المحفوظة تعرض بند الانتريه بالعدد المختار', view.includes('2 كنبة + 1 كرسي + ترابيزة'), view.slice(0, 200));

// ===== فاتورة بعميل موجود + بند مطبخ بعدد مكتوب + عربون، ثم تعديلها =====
const ITEMS_TABLE = '#view .card.no-print table';
const ACTIVE_CUSTOMER = '.card:has(h3:has-text("بيانات الفاتورة"))';
await page.evaluate(() => { location.hash = '/invoices/new'; });
await page.waitForSelector('.cat-grid');
check('الفاتورة الجديدة: لا بنود ولا معاينة قبل الإضافة', (await page.locator('#view .empty').innerText()).includes('لم تُضف بنود بعد'));
await page.click('button:has-text("حفظ الفاتورة")');
await page.waitForFunction(() => document.body.innerText.includes('أضف بنداً واحداً على الأقل'));
check('الحفظ بلا بنود يُرفض برسالة واضحة', true);
await page.selectOption(`${ACTIVE_CUSTOMER} select`, { label: (await page.locator(`${ACTIVE_CUSTOMER} select option`).allTextContents()).find(t => t.includes('عميل اختبار')) });
await page.click('.cat-tile[data-v="مطبخ"]');
await page.waitForSelector('.fields2 .st-in');
await page.fill('.fields2 .st-in', '12');
await page.fill('input[placeholder="مثال: 50000"]', '2500');
await page.click('.add-btn');
await page.waitForSelector(ITEMS_TABLE);
check('بند المطبخ بعدد مكتوب (12 ضلفة) أُضيف للجدول', (await page.locator(`${ITEMS_TABLE} tbody`).innerText()).includes('12 ضلفة'));
check('الإجمالي يُحسب تلقائياً من أسعار البنود', (await page.inputValue('input[placeholder="الإجمالي بالجنيه"]')) === '2500');
await page.fill('input[placeholder="العربون بالجنيه"]', '9999');
await page.click('button:has-text("حفظ الفاتورة")');
await page.waitForFunction(() => document.body.innerText.includes('العربون لا يزيد عن الإجمالي'));
check('عربون أكبر من الإجمالي يُرفض', true);
await page.fill('input[placeholder="العربون بالجنيه"]', '500');
await page.click('button:has-text("حفظ الفاتورة")');
await page.waitForFunction(() => location.hash.startsWith('#/invoice?id='));
await page.waitForTimeout(400);
const savedView = await page.locator('#view').innerText();
check('الفاتورة المحفوظة تعرض بند المطبخ والإجمالي', savedView.includes('12 ضلفة') && savedView.includes('2,500'), savedView.slice(0, 160));
check('العربون سُجّل دفعة على الفاتورة', savedView.includes('500'));
const savedId = await page.evaluate(() => new URLSearchParams(location.hash.split('?')[1]).get('id'));
await page.evaluate((id) => { location.hash = `/invoice/edit?id=${id}`; }, savedId);
await page.waitForSelector('.builder');
await page.waitForTimeout(200);
check('التعديل: العميل مقفول لوجود دفعات', await page.locator(`${ACTIVE_CUSTOMER} select`).isDisabled());
check('التعديل: الإجمالي الحالي معبّأ', (await page.inputValue('input[placeholder="الإجمالي بالجنيه"]')) === '2500');
check('التعديل: بنود الفاتورة محمّلة', (await page.locator(`${ITEMS_TABLE} tbody tr`).count()) === 1);
check('التعديل: حقل الإجمالي للقراءة فقط', await page.locator('input[placeholder="الإجمالي بالجنيه"]').evaluate((e) => e.readOnly));
await page.click('.cat-tile[data-v="انتريه"]');
await page.click('.fields2 .opt:has-text("كنبتان")');
await page.click('.fields2 .opt:has-text("كرسي واحد")');
await page.fill('input[placeholder="مثال: 50000"]', '500');
await page.click('.add-btn');
check('التعديل: الإجمالي يُعاد جمعه (2500 + 500)', (await page.inputValue('input[placeholder="الإجمالي بالجنيه"]')) === '3000');
await page.click('button:has-text("حفظ التعديلات")');
await page.waitForFunction(() => location.hash.startsWith('#/invoice?id='));
await page.waitForTimeout(400);
check('التعديل يحفظ الإجمالي الجديد', (await page.locator('#view').innerText()).includes('3,000'));

// ===== النوم: لا حقول عرض/طول، والبند يجهز بعد اختيار النوع =====
await page.evaluate(() => { location.hash = '/invoices/new'; });
await page.waitForSelector('.cat-grid');
await page.click('.cat-tile[data-v="نوم"]');
await page.waitForSelector('.pick');
await page.click('.pick:has(.pn:text-is("دولاب")) .pick-head');
check('لا حقول عرض وطول في أي مكان', (await page.locator('.size-row, input[placeholder="العرض"], input[placeholder="الطول"]').count()) === 0);
await page.click('.pick:has(.pn:text-is("دولاب")) .opt:text-is("ضلفة")');
await page.click('.fields2 .opt:text-is("كلاسيك")');
check('بند النوم جاهز للإضافة', (await page.locator('.stat').innerText()).includes('جاهز'), await page.locator('.stat').innerText());

// ===== ترحيل إعداد انتريه قديم (نص ثابت) محفوظ في قاعدة البيانات =====
await page.evaluate(() => new Promise((res, rej) => {
  const r = indexedDB.open('workshopDB');
  r.onsuccess = () => {
    const db = r.result, tx = db.transaction('settings', 'readwrite');
    tx.objectStore('settings').put({ key: 'catalog', value: { styles: ['مودرن'], categories: [
      { id: 'entree', name: 'انتريه', kind: 'fixed', text: '2 كنبة + 2 كرسي + ترابيزة' }] }, updatedAt: new Date().toISOString() });
    tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
  };
}));
await page.reload();
await page.evaluate(() => { location.hash = '/invoices/new'; });
await page.waitForSelector('.cat-grid');
await page.click('.cat-tile[data-v="انتريه"]');
await page.waitForSelector('.fields2 .opt');
check('الإعداد القديم (نص ثابت) يُرحَّل ويعرض أزرار الاختيار', (await page.locator('.fields2 .opt').count()) === 4);

// ===== اختبارات الوحدات داخل المتصفح (تشمل ما يحتاج DOM) =====
check('لا أخطاء JavaScript طوال الجلسة', problems.length === 0, problems.join(' | '));
const { createServer } = await import('node:http');
const { readFile } = await import('node:fs/promises');
const server = createServer(async (req, res) => {
  try {
    const file = resolve(root, decodeURIComponent(req.url.split('?')[0]).slice(1));
    const body = await readFile(file);
    const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type + '; charset=utf-8' }); res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const port = server.address().port;
const unit = await browser.newPage();
await unit.goto(`http://localhost:${port}/tests/tests.html`);
await unit.waitForFunction(() => document.title !== 'اختبارات', null, { timeout: 15000 });
const failedUnits = await unit.locator('li:has-text("✘")').allTextContents();
const totalUnits = await unit.locator('li').count();
check(`اختبارات الوحدات في المتصفح (${totalUnits})`, failedUnits.length === 0, failedUnits.join(' | '));
server.close();
await browser.close();
const failed = results.filter(x => !x).length;
console.log(`\n${results.length - failed}/${results.length} نجح`);
process.exit(failed ? 1 : 0);
