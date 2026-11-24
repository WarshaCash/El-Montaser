// اختبار حفظ النسخ الاحتياطية في Chrome حقيقي: «حفظ باسم» المباشر، الإلغاء، الرجوع للتنزيل العادي، وعدم إلغاء الرابط مبكراً.
// التشغيل:  node tests/backup.e2e.mjs        (يحتاج playwright + Chromium للتطوير فقط)
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { readFileSync } from 'node:fs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const url = pathToFileURL(resolve(root, 'index.html')).href;
let bad = 0;
const check = (name, ok, extra = '') => { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${ok ? '' : extra}`); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(url);
await page.waitForSelector('#nav a');
await page.evaluate(() => { location.hash = '#/settings'; });
await page.waitForSelector('button:has-text("إنشاء نسخة احتياطية الآن")');

const JSON_BTN = 'button:has-text("إنشاء نسخة احتياطية الآن")', ZIP_BTN = 'button:has-text("تنزيل نسخة مفصلة ZIP")';
const status = () => page.locator('#view').innerText();
/** يستبدل showSaveFilePicker بنسخة تجريبية: mode = ok | abort | fail */
const stubPicker = (mode) => page.evaluate((m) => {
  window.__written = null;
  if (m === 'none') { delete window.showSaveFilePicker; return; }
  window.showSaveFilePicker = async ({ suggestedName }) => {
    if (m === 'abort') throw Object.assign(new Error('x'), { name: 'AbortError' });
    if (m === 'fail') throw Object.assign(new Error('x'), { name: 'SecurityError' });
    return { name: 'مختار-' + suggestedName, createWritable: async () => ({ write: async (b) => { window.__written = await b.text(); }, close: async () => {} }) };
  };
}, mode);

// 1) نافذة «حفظ باسم» تنجح: يُكتب الملف مباشرة بلا تنزيل
await stubPicker('ok');
await page.click(JSON_BTN);
await page.waitForFunction(() => window.__written !== null);
const written = await page.evaluate(() => window.__written);
check('حفظ باسم: يُكتب JSON صالح لنسخة النظام', JSON.parse(written).app === 'workshop-system');
check('الرسالة تذكر الاسم الذي اختاره المستخدم', (await status()).includes('مختار-workshop-backup-'));
check('سُجّل وقت آخر نسخة', (await status()).includes('آخر نسخة احتياطية'));

// 2) إلغاء النافذة: لا ملف ولا تسجيل «نسخة ناجحة»
await page.evaluate(() => { location.hash = '#/settings'; location.reload(); });
await page.waitForSelector(JSON_BTN);
await stubPicker('abort');
await page.click(JSON_BTN);
await page.waitForSelector('text=أُلغي حفظ الملف');
check('الإلغاء يعرض رسالة ولا يكتب شيئاً', (await page.evaluate(() => window.__written)) === null);

// 3) تعذّر النافذة (مثلاً سياق غير مسموح): يرجع للتنزيل العادي وينجح
await stubPicker('fail');
const [d1] = await Promise.all([page.waitForEvent('download'), page.click(JSON_BTN)]);
check('الرجوع للتنزيل العادي عند تعذّر النافذة', !(await d1.failure()) && d1.suggestedFilename().endsWith('.json'));
check('الملف المنزَّل صالح', JSON.parse(readFileSync(await d1.path(), 'utf8')).app === 'workshop-system');

// 4) متصفح بلا الواجهة (Firefox مثلاً): تنزيل عادي لـ JSON و ZIP
await stubPicker('none');
const [d2] = await Promise.all([page.waitForEvent('download'), page.click(JSON_BTN)]);
check('بلا واجهة الحفظ: تنزيل JSON ناجح', !(await d2.failure()));
const [d3] = await Promise.all([page.waitForEvent('download'), page.click(ZIP_BTN)]);
const zip = readFileSync(await d3.path());
check('بلا واجهة الحفظ: تنزيل ZIP ناجح وبرأس ZIP صحيح', !(await d3.failure()) && zip.readUInt32LE(0) === 0x04034b50);

// 5) ZIP عبر «حفظ باسم»
await stubPicker('ok');
await page.click(ZIP_BTN);
await page.waitForFunction(() => window.__written !== null);
check('ZIP عبر حفظ باسم يُكتب', (await page.evaluate(() => window.__written)).startsWith('PK'));

// 6) الرابط لا يُلغى قبل أن يستطيع المتصفح قراءته (السبب الأصلي لـ «فشل» التنزيل)
await stubPicker('none');
await page.evaluate(() => { window.__revoked = []; const orig = URL.revokeObjectURL.bind(URL); URL.revokeObjectURL = (u) => { window.__revoked.push(Date.now()); orig(u); }; });
const [d4] = await Promise.all([page.waitForEvent('download'), page.click(JSON_BTN)]);
await d4.path();
await page.waitForTimeout(6500);
check('لا يُلغى رابط التنزيل خلال أول 6 ثوانٍ', (await page.evaluate(() => window.__revoked.length)) === 0);

check('لا أخطاء JavaScript', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(bad ? `\n${bad} فحص فشل` : '\nكل فحوص النسخ الاحتياطي نجحت');
process.exit(bad ? 1 : 0);
