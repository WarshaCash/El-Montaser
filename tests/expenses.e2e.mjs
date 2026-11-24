// اختبار قسم المصروفات في متصفح حقيقي: التسجيل بالورشة، ملف الشهر، الطباعة، الإلغاء، والنسخة المفصلة ZIP.
// التشغيل:  node tests/expenses.e2e.mjs        (يحتاج playwright + Chromium للتطوير فقط)
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const url = pathToFileURL(resolve(root, 'index.html')).href;
const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 1300, height: 1100 }, acceptDownloads: true });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
let ok = 0, bad = 0; const check = (n, c, x = '') => { c ? ok++ : bad++; console.log(c ? 'PASS' : 'FAIL', n, c ? '' : x); };
await page.goto(url); await page.waitForSelector('#nav a');
const nowYm = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });
check('عنصر «المصروفات» في القائمة', (await page.locator('#nav a', { hasText: 'المصروفات' }).count()) === 1);
await page.click('#nav a:has-text("المصروفات")'); await page.waitForSelector('form.row');
check('تاريخ الإدخال الافتراضي = اليوم المحلي', (await page.locator('input[type=date]').inputValue()).startsWith(nowYm));
const add = async (date, cat, ws, amt, note = '') => {
  await page.locator('form.row input[type=date]').fill(date); await page.fill('input[placeholder^="بند"]', cat);
  if (ws) await page.selectOption('form.row select', ws); await page.fill('input[placeholder="المبلغ بالجنيه"]', amt);
  await page.fill('input[placeholder^="ملاحظات"]', note); await page.click('button:has-text("تسجيل المصروف")'); };
// بلا ورشة: المتصفح يمنع الإرسال
await add(`${nowYm}-05`, 'بنزين', '', '100'); await page.waitForTimeout(300);
check('لا يُسجَّل مصروف بلا ورشة', (await page.locator('tbody tr').count()) === 0 || (await page.locator('td', { hasText: 'بنزين' }).count()) === 0);
await add(`${nowYm}-05`, 'خشب زان', 'carpentry', '1500'); await page.waitForSelector('td:has-text("خشب زان")');
check('الرابط يذهب لشهر المصروف', (await page.evaluate(() => location.hash)) === `#/expenses?m=${nowYm}`);
await add(`${nowYm}-28`, 'دهان <أبيض>', 'paint', '700.50', 'لترين'); await page.waitForSelector('td:has-text("دهان")');
const prev = await page.evaluate((ym) => { const [y, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y, m - 2, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; }, nowYm);
await add(`${prev}-30`, 'سابق', 'carpentry', '50'); await page.waitForSelector(`td:has-text("سابق")`);
check('انتقل لشهر السابق وفيه صف واحد فقط', (await page.locator('tbody tr').first().innerText()).includes('سابق'));
await page.goto(url + `#/expenses?m=${nowYm}`); await page.waitForSelector('td:has-text("خشب زان")'); await page.reload(); await page.waitForSelector('td:has-text("خشب زان")');
const kpis = (await page.locator('.kpi').allInnerTexts()).map(t => t.replace(/\s+/g, ' '));
check('إجمالي الشهر 2,200.50 ج.م', kpis.some(t => t.includes('2,200.50')), kpis.join(' | '));
check('إجمالي النجارة 1,500 والدهانات 700.50', kpis.some(t => t.includes('النجارة') && t.includes('1,500')) && kpis.some(t => t.includes('الدهانات') && t.includes('700.50')), kpis.join(' | '));
check('ملاحظة الصف ظاهرة', (await page.locator('td', { hasText: 'لترين' }).count()) === 1);
check('قائمة الشهور فيها الشهرين', (await page.locator('a', { hasText: /20\d\d$/ }).count()) >= 2);
// الطباعة
await page.click('button:has-text("طباعة مصروفات الشهر")'); await page.waitForSelector('iframe[data-print]', { state: 'attached' });
const html = await page.locator('iframe[data-print]').getAttribute('srcdoc');
check('تقرير الطباعة: عنوان الشهر والإجمالي والتعقيم', html.includes('كشف مصروفات شهر') && html.includes('2,200.50 ج.م') && html.includes('&lt;أبيض&gt;') && !html.includes('<أبيض>'));
const last = await page.evaluate((ym) => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); }, nowYm);
check('نطاق الطباعة من 01 إلى آخر الشهر', html.includes(`من 01 / ${nowYm.slice(5)} / ${nowYm.slice(0, 4)} إلى ${last} /`), html.match(/من 01[^<]*/)?.[0]);
const rep = await ctx.newPage(); await rep.setViewportSize({ width: 794, height: 1123 }); await rep.setContent(html);
await rep.screenshot({ path: resolve(tmpdir(), 'expenses-report.png') }); await rep.pdf({ path: resolve(tmpdir(), 'expenses-report.pdf'), format: 'A4', printBackground: true }); await rep.close();
// الإلغاء
page.once('dialog', d => d.accept('خطأ إدخال'));
await page.locator('tr', { hasText: 'خشب زان' }).locator('button:has-text("إلغاء")').click(); await page.waitForFunction(() => !document.body.innerText.includes('خشب زان') || document.querySelectorAll('tbody tr').length < 3);
await page.waitForTimeout(400);
const k2 = (await page.locator('.kpi').allInnerTexts()).join(' ').replace(/\s+/g, ' ');
check('بعد الإلغاء يسقط من الشهر: الإجمالي 700.50', k2.includes('700.50') && !k2.includes('2,200.50'), k2);
// مرتبات الصنايعية
await page.fill('input[placeholder="اسم الصنايعي"]', 'أحمد النجار'); await page.selectOption('form.row:has(input[placeholder="اسم الصنايعي"]) select', 'carpentry');
await page.click('button:has-text("إضافة صنايعي")'); await page.waitForSelector('summary:has-text("الصنايعية المسجلون (1)")');
await page.fill('input[placeholder="اسم الصنايعي"]', 'احمد النجار'); await page.selectOption('form.row:has(input[placeholder="اسم الصنايعي"]) select', 'carpentry');
await page.click('button:has-text("إضافة صنايعي")'); await page.waitForSelector('.err:has-text("مسجّل بالفعل")');
check('منع تكرار الصنايعي بنفس الاسم والورشة', true);
const payRow = page.locator('form.row:has(button:has-text("تسجيل الدفعة"))');
const paid = async (type, amount) => { await payRow.locator('select').nth(0).selectOption({ label: 'أحمد النجار — ورشة النجارة' }); await payRow.locator('select').nth(1).selectOption(type);
  await payRow.locator('input[placeholder="المبلغ بالجنيه"]').fill(amount); await payRow.locator('button:has-text("تسجيل الدفعة")').click(); await page.waitForTimeout(500); };
check('الورشة تُملأ تلقائياً من الصنايعي', await (async () => { await payRow.locator('select').nth(0).selectOption({ label: 'أحمد النجار — ورشة النجارة' }); return (await payRow.locator('select').nth(2).inputValue()) === 'carpentry'; })());
await paid('salary', '800'); await page.waitForSelector('td:has-text("مرتبات الصنايعية — أحمد النجار")');
await paid('advance', '200'); await page.waitForSelector('td:has-text("سلف الصنايعية — أحمد النجار")');
const view = (await page.locator('#view').innerText()).replace(/\s+/g, ' ');
check('كشف الصنايعية: مرتبات 800 وسلف 200 وإجمالي 1,000', view.includes('كشف مرتبات الصنايعية') && /أحمد النجار 800 ج\.م 200 ج\.م 1,000 ج\.م/.test(view), view.slice(view.indexOf('كشف مرتبات'), view.indexOf('كشف مرتبات') + 160));
check('إجمالي الشهر صار 1,700.50', (await page.locator('.kpi').allInnerTexts()).join(' ').replace(/\s+/g, ' ').includes('1,700.50'));
await page.click('button:has-text("طباعة مصروفات الشهر")'); await page.waitForSelector('iframe[data-print]', { state: 'attached' });
const html2 = await page.locator('iframe[data-print]').getAttribute('srcdoc');
check('الطباعة تحوي كشف الصنايعية', html2.includes('كشف مرتبات الصنايعية') && html2.includes('أحمد النجار') && html2.includes('1,700.50 ج.م'));
await page.locator('summary:has-text("الصنايعية المسجلون")').click(); await page.locator('tr', { hasText: 'أحمد النجار' }).locator('button:has-text("إيقاف")').click();
await page.waitForSelector('text=أضف صنايعياً أولاً');
check('الصنايعي الموقوف لا يظهر في قائمة الصرف', true);
// الخزينة
await page.click('#nav a:has-text("الخزينة")'); await page.waitForSelector('.kpi');
const tre = await page.locator('#view').innerText();
check('الخزينة: لا نموذج مصروف ولا بطاقة المصروفات', !tre.includes('تسجيل مصروف') && !tre.includes('فتح قسم المصروفات'));
check('بيان الخزينة يذكر الورشة', tre.includes('دهان') && tre.includes('ورشة الدهانات'));
check('بيان الخزينة يذكر الصنايعي', tre.includes('مرتبات الصنايعية — أحمد النجار'));
// الرئيسية
await page.click('#nav a:has-text("الرئيسية")'); await page.waitForSelector('.tiles');
check('بلاطة «المصروفات» في الرئيسية', (await page.locator('.tiles', { hasText: 'المصروفات' }).count()) === 1);
// نسخة ZIP المفصلة
await page.evaluate(() => { location.hash = '#/settings'; }); await page.waitForSelector('button:has-text("تنزيل نسخة مفصلة ZIP")');
await page.evaluate(() => { delete window.showSaveFilePicker; }); // المتصفح بلا واجهة لا يستطيع عرض نافذة «حفظ باسم»: نختبر مسار التنزيل العادي
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("تنزيل نسخة مفصلة ZIP")')]); await dl.saveAs(resolve(tmpdir(), 'expenses-folders.zip'));
check('لا أخطاء JavaScript', errs.length === 0, errs.join(' | '));
console.log(`\nok=${ok} bad=${bad}`); await browser.close(); process.exit(bad ? 1 : 0);
