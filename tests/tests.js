import { parsePiastres, formatEGP, formatDate } from '../js/core/formatters.js';
import { normText, normalizePhone, phoneForUpdate } from '../js/core/validators.js';
import { localToday } from '../js/core/formatters.js';
import {
  validateExpense, monthBounds, shiftMonth, monthLabel, monthExpenses, summarizeExpenses, expenseMonths, businessNameFrom,
  cleanWorker, summarizePayroll, expenseTitle,
} from '../js/domain/expenses.js';
import { expenseCsv, expenseReportHtml } from '../js/domain/expenseReport.js';
import { buildExpenseMonthFiles } from '../js/infrastructure/expenseFiles.js';
import { customerBalance, treasuryBalance, invoiceTotals, validatePayment, customerStatement } from '../js/domain/accounting.js';
import { normalize, getConfig, setConfig } from '../js/domain/catalog/catalog.js';
import { buildCustomerFiles, safeName } from '../js/infrastructure/backup.js';
import { crc32, makeZip } from '../js/core/zip.js';
import { pdfFromJpegs } from '../js/infrastructure/pdf.js';
import { resizeBox, marginsOf, boxFromMargins, fitBox, cm, toMm, PAGE_W, PAGE_H } from '../js/features/settings/cropEditor.js';
import { validateBackup } from '../js/infrastructure/backup.js';
import { STORE_NAMES, KEYED } from '../js/infrastructure/db/schema.js';
import { amountInWords, numberInWords } from '../js/core/words.js';
import { qrMatrix } from '../js/core/qr.js';
import { runRepositoryTests } from './repositories.test.js';
const PX_MM = 96 / 25.4;
export function runTests() {
  const out = [], t = (n, f) => { try { f(); out.push([n, true]); } catch (e) { out.push([n, false, e.message]); } };
  const eq = (a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${JSON.stringify(a)} != ${JSON.stringify(b)}`); };
  t('تحويل 10.10 إلى 1010 قرش', () => eq(parsePiastres('10.10'), 1010));
  t('0.1+0.2 بدقة', () => eq(parsePiastres('0.1') + parsePiastres('0.2'), 30));
  t('أرقام عربية', () => eq(parsePiastres('١٢٫٥'), 1250));
  t('رفض مبلغ غير صالح', () => { let r = false; try { parsePiastres('abc'); } catch { r = true; } eq(r, true); });
  const items = [{ qty: 2, unitPricePiastres: 500000 }, { qty: 1, unitPricePiastres: 250000 }];
  t('صافي التعاقد', () => eq(invoiceTotals(items, []).net, 1250000));
  t('بلا دفعات: المدفوع 0 والمتبقي الصافي', () => { const x = invoiceTotals(items, []); eq([x.paid, x.remaining], [0, 1250000]); });
  t('مجموع دفعتين', () => eq(invoiceTotals(items, [{ status: 'active', amountPiastres: 100 }, { status: 'active', amountPiastres: 50 }]).paid, 150));
  t('الدفعة الملغاة لا تُحسب', () => eq(invoiceTotals(items, [{ status: 'reversed', amountPiastres: 999 }]).paid, 0));
  t('الدفع الزائد رصيد دائن', () => { const x = invoiceTotals(items, [{ status: 'active', amountPiastres: 1300000 }]); eq([x.remaining, x.credit], [0, 50000]); });
  t('رفض دفعة صفر', () => eq(validatePayment({ amountPiastres: 0, paidAt: '2026-01-01', method: 'نقدي', customerId: 'c', opId: 'o' }).length, 1));
  t('قبول دفعة صحيحة', () => eq(validatePayment({ amountPiastres: 5, paidAt: '2026-01-01', method: 'نقدي', customerId: 'c', opId: 'o' }), []));
  t('كشف الحساب مرتب مع الرصيد', () => {
    const s = customerStatement({ id: 'c', createdAt: '2026-01-01' }, [{ id: 'i', status: 'active', invoiceDate: '2026-01-02' }], { i: items },
      [{ status: 'active', paidAt: '2026-01-03', amountPiastres: 600000, id: 'p' }]);
    eq(s.map(r => r.balance), [1250000, 650000]);
  });
  t('كشف الحساب: الرصيد الافتتاحي بوقت كامل يسبق فاتورة ودفعة نفس اليوم', () => {
    const c = { id: 'c', openingBalancePiastres: 100000, createdAt: '2026-01-02T09:30:00.000Z' };
    const s = customerStatement(c, [{ id: 'i', status: 'active', invoiceDate: '2026-01-02', netContractPiastres: 500000 }], {}, [{ status: 'active', paidAt: '2026-01-02', amountPiastres: 200000, id: 'p' }]);
    eq(s.map(r => r.type), ['رصيد افتتاحي', 'فاتورة', 'دفعة']); eq(s.map(r => r.balance), [100000, 600000, 400000]); eq(s[0].date, '2026-01-02');
  });
  t('كشف الحساب: الدفعة في يوم سابق للفاتورة تسبقها، والحركات المتماثلة بترتيب إدخالها', () => {
    const s = customerStatement({ id: 'c', createdAt: '2026-01-01' }, [{ id: 'i', status: 'active', invoiceDate: '2026-01-05', netContractPiastres: 300000 }], {},
      [{ status: 'active', paidAt: '2026-01-03', amountPiastres: 50000, id: 'p1' }, { status: 'active', paidAt: '2026-01-05', amountPiastres: 10000, id: 'p2' }, { status: 'active', paidAt: '2026-01-05', amountPiastres: 20000, id: 'p3' }]);
    eq(s.map(r => r.ref), ['p1', 'i', 'p2', 'p3']); eq(s.map(r => r.balance), [-50000, 250000, 240000, 220000]);
  });
  const th = (f) => { let r = false; try { f(); } catch { r = true; } eq(r, true); };
  t('هاتف التعديل: الفارغ يُقبل لعميل بلا هاتف فقط', () => {
    eq(phoneForUpdate('', ''), ''); eq(phoneForUpdate('  ', undefined), ''); eq(phoneForUpdate('٠١٠١٢٣٤٥٦٧٨', ''), '01012345678');
    th(() => phoneForUpdate('', '01012345678')); th(() => phoneForUpdate('0101', '')); th(() => phoneForUpdate('0101', '01012345678'));
  });
  // ===== المصروفات حسب الورشة وملف كل شهر =====
  const E = (id, date, category, workshop, amountPiastres, extra = {}) => ({ id, date, category, workshop, amountPiastres, status: 'active', createdAt: id, ...extra });
  const NOV = [E('a', '2026-11-20', 'خامات', 'carpentry', 150000), E('b', '2026-11-01', 'دهان', 'paint', 70050, { notes: 'لتر <b>أبيض</b>' }),
    E('c', '2026-11-30', 'قديم بلا ورشة', undefined, 5000), E('d', '2026-11-10', 'ملغى', 'paint', 99900, { status: 'reversed' }), E('e', '2026-10-31', 'أكتوبر', 'paint', 1000)];
  t('المصروف: التحقق يطلب الورشة والبند والمبلغ الصحيح والتاريخ الحقيقي', () => {
    const ok = { date: '2026-11-05', category: ' بنزين ', workshop: 'paint', amountPiastres: 5000, notes: ' x ' };
    eq(validateExpense(ok), { date: '2026-11-05', category: 'بنزين', workshop: 'paint', amountPiastres: 5000, notes: 'x' });
    th(() => validateExpense({ ...ok, workshop: '' })); th(() => validateExpense({ ...ok, workshop: 'other' })); th(() => validateExpense({ ...ok, category: ' ' }));
    th(() => validateExpense({ ...ok, amountPiastres: 0 })); th(() => validateExpense({ ...ok, amountPiastres: 10.5 })); th(() => validateExpense({ ...ok, date: '2026-02-30' }));
  });
  t('الشهر: من 1 إلى آخر يوم (28/29/30/31) والتنقل بين الشهور', () => {
    eq(monthBounds('2026-02'), { from: '2026-02-01', to: '2026-02-28', days: 28 }); eq(monthBounds('2028-02').to, '2028-02-29');
    eq(monthBounds('2026-11').to, '2026-11-30'); eq(monthBounds('2026-12').to, '2026-12-31'); th(() => monthBounds('2026-13'));
    eq([shiftMonth('2026-12', 1), shiftMonth('2026-01', -1)], ['2027-01', '2025-12']); eq(monthLabel('2026-11'), 'نوفمبر 2026');
  });
  t('ملف الشهر: الفعّال فقط ضمن الشهر مرتباً بالتاريخ، والإجمالي لكل ورشة', () => {
    eq(monthExpenses(NOV, '2026-11').map(e => e.id), ['b', 'a', 'c']);
    const s = summarizeExpenses(monthExpenses(NOV, '2026-11'));
    eq([s.count, s.total], [3, 225050]); eq(s.byWorkshop.map(g => [g.name, g.total]), [['ورشة النجارة', 150000], ['ورشة الدهانات', 70050], ['غير محدد', 5000]]);
    eq(summarizeExpenses([]).byWorkshop.map(g => g.name), ['ورشة النجارة', 'ورشة الدهانات']);
    eq(expenseMonths(NOV).map(m => [m.ym, m.count]), [['2026-11', 3], ['2026-10', 1]]);
  });
  t('تقرير الشهر HTML: مدى التاريخ والإجماليات وتعقيم النص', () => {
    const html = expenseReportHtml({ business: 'ورشة <test>', ym: '2026-11', rows: monthExpenses(NOV, '2026-11'), printedAt: '2026-11-21' });
    for (const part of ['من 01 / 11 / 2026 إلى 30 / 11 / 2026', 'كشف مصروفات شهر نوفمبر 2026', '2,250.50 ج.م', 'إجمالي ورشة النجارة', '1,500 ج.م'])
      eq([part, html.includes(part)], [part, true]);
    eq([html.includes('<b>أبيض'), html.includes('&lt;b&gt;'), html.includes('ورشة <test>')], [false, true, false]);
    eq(expenseReportHtml({ business: 'x', ym: '2026-02', rows: [], printedAt: '2026-02-01' }).includes('لا توجد مصروفات'), true);
  });
  t('تقرير الشهر CSV: BOM وصفوف وإجماليات بالجنيه', () => {
    const lines = expenseCsv(monthExpenses(NOV, '2026-11')).split('\r\n');
    eq(lines[0], '\ufeffم,التاريخ,البند,خاص بـ,ملاحظات,المبلغ (جنيه)'); eq(lines[1], '1,2026-11-01,دهان,ورشة الدهانات,لتر <b>أبيض</b>,700.50');
    eq(lines.at(-1), ',,,إجمالي المصروفات,,2250.50');
  });
  t('النسخة المفصلة: مجلد مستقل لكل شهر بالملفات الثلاثة، والملغاة في JSON فقط', () => {
    const files = buildExpenseMonthFiles({ expenses: NOV, auditLogs: [{ refId: 'a', action: 'x' }], settings: [{ key: 'printBiz', value: { name: 'ورشتي' } }] }, '2026-11-21');
    const paths = files.map(f => f.path);
    eq(paths.filter(p => p.startsWith('المصروفات/2026-11 نوفمبر/')), ['المصروفات/2026-11 نوفمبر/بيانات الشهر.json', 'المصروفات/2026-11 نوفمبر/المصروفات.csv',
      'المصروفات/2026-11 نوفمبر/تقرير المصروفات.html', 'المصروفات/2026-11 نوفمبر/سجل التدقيق.json']);
    eq([paths.includes('المصروفات/2026-10 أكتوبر/المصروفات.csv'), paths.includes('المصروفات/اقرأني.txt')], [true, true]);
    const data = JSON.parse(files.find(f => f.path.endsWith('2026-11 نوفمبر/بيانات الشهر.json')).text);
    eq([data.من, data.إلى, data.المصروفات.length, data.الملخص['الإجمالي (جنيه)']], ['2026-11-01', '2026-11-30', 4, '2250.50']);
    eq(files.find(f => f.path.endsWith('2026-11 نوفمبر/تقرير المصروفات.html')).text.includes('ورشتي'), true);
    eq(files.find(f => f.path.endsWith('2026-11 نوفمبر/المصروفات.csv')).text.includes('ملغى'), false);
    eq(buildExpenseMonthFiles({ expenses: [], settings: [] }), []);
  });
  // ===== مرتبات الصنايعية =====
  const SAL = { date: '2026-11-07', workshop: 'carpentry', amountPiastres: 80000, salaryType: 'salary', workerId: 'w1', workerName: 'أحمد' };
  t('المرتب/السلفة: البند ثابت ويُشترط الصنايعي والنوع الصحيح', () => {
    const ok = validateExpense(SAL);
    eq([ok.category, ok.salaryType, ok.workerId, ok.workerName], ['مرتبات الصنايعية', 'salary', 'w1', 'أحمد']);
    eq(validateExpense({ ...SAL, salaryType: 'advance', category: 'تجاهل' }).category, 'سلف الصنايعية');
    th(() => validateExpense({ ...SAL, workerId: '' })); th(() => validateExpense({ ...SAL, workerName: ' ' })); th(() => validateExpense({ ...SAL, salaryType: 'bonus' }));
    th(() => validateExpense({ ...SAL, workshop: '' })); th(() => validateExpense({ ...SAL, amountPiastres: 0 }));
    eq(expenseTitle(ok), 'مرتبات الصنايعية — أحمد'); eq(expenseTitle({ category: 'خامات' }), 'خامات');
  });
  t('الصنايعي: تنظيف الاسم ومنع التكرار في الورشة نفسها فقط', () => {
    eq(cleanWorker({ name: '  أحمد   علي ', workshop: 'paint', trade: ' دهان ' }), { name: 'أحمد علي', workshop: 'paint', trade: 'دهان' });
    th(() => cleanWorker({ name: '', workshop: 'paint' })); th(() => cleanWorker({ name: 'س', workshop: '' }));
    th(() => cleanWorker({ name: 'احمد', workshop: 'paint' }, [{ name: 'أحمد', workshop: 'paint' }]));
    eq(cleanWorker({ name: 'احمد', workshop: 'carpentry' }, [{ name: 'أحمد', workshop: 'paint' }]).workshop, 'carpentry');
  });
  const PAY = [E('p1', '2026-11-07', 'مرتبات الصنايعية', 'carpentry', 80000, { workerId: 'w1', workerName: 'أحمد', salaryType: 'salary' }),
    E('p2', '2026-11-09', 'سلف الصنايعية', 'carpentry', 20000, { workerId: 'w1', workerName: 'أحمد', salaryType: 'advance' }),
    E('p3', '2026-11-10', 'مرتبات الصنايعية', 'paint', 50000, { workerId: 'w2', workerName: 'بشير', salaryType: 'salary' }), E('p4', '2026-11-11', 'خامات', 'paint', 1000)];
  t('كشف الصنايعية: مرتبات وسلف وإجمالي لكل صنايعي، والمصروف العادي خارجه', () => {
    const s = summarizePayroll(PAY);
    eq(s.workers.map(r => [r.workerName, r.salary, r.advance, r.total]), [['أحمد', 80000, 20000, 100000], ['بشير', 50000, 0, 50000]]);
    eq([s.salary, s.advance, s.total], [130000, 20000, 150000]); eq(summarizePayroll([E('x', '2026-11-01', 'خامات', 'paint', 5)]).workers, []);
  });
  t('الطباعة والملفات تذكر كشف الصنايعية', () => {
    const rows = monthExpenses(PAY, '2026-11'), html = expenseReportHtml({ business: 'ب', ym: '2026-11', rows, printedAt: '2026-11-21' });
    for (const part of ['كشف مرتبات الصنايعية', 'مرتبات الصنايعية — أحمد', 'بشير', '1,500 ج.م']) eq([part, html.includes(part)], [part, true]);
    eq(expenseReportHtml({ business: 'ب', ym: '2026-11', rows: monthExpenses(NOV, '2026-11'), printedAt: '2026-11-21' }).includes('كشف مرتبات'), false);
    const csv = expenseCsv(rows); eq([csv.includes('كشف مرتبات الصنايعية'), csv.includes('800.00 + 200.00,1000.00')], [true, true]);
    const json = JSON.parse(buildExpenseMonthFiles({ expenses: PAY, settings: [] }).find(f => f.path.endsWith('2026-11 نوفمبر/بيانات الشهر.json')).text);
    eq(json.الملخص['مرتبات وسلف الصنايعية'], { أحمد: '1000.00', بشير: '500.00' });
  });
  t('الأسماء والتاريخ المحلي', () => {
    eq(businessNameFrom({ name: '  ' }).length > 5, true); eq(businessNameFrom({ name: 'س' }), 'س');
    const d = new Date(); eq(localToday(), `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  });
  t('مكتبة شاشة 119 مرفوض و120 مقبول', () => { th(() => normalize('مكتبة شاشة', { sizeCm: 119 })); normalize('مكتبة شاشة', { sizeCm: 120 }); });
  t('سفرة 11 كرسي مرفوض', () => th(() => normalize('سفرة', { chairs: 11 })));
  t('دنسوار 500 مقبول و501 مرفوض', () => { normalize('دنسوار', { sizeCm: 500 }); th(() => normalize('دنسوار', { sizeCm: 501 })); });
  t('انتريه: 1 أو 2 كنبة و1 أو 2 كرسي + ترابيزة', () => { const a = normalize('انتريه', { sofas: '1', chairs: '2' }); eq(a.description, '1 كنبة + 2 كرسي + ترابيزة'); eq(a.specs, { sofas: 1, chairs: 2, table: 1 }); eq(normalize('انتريه', { sofas: '2', chairs: '1' }).description, '2 كنبة + 1 كرسي + ترابيزة'); th(() => normalize('انتريه', { sofas: '3', chairs: '1' })); th(() => normalize('انتريه', { sofas: '1', chairs: '0' })); th(() => normalize('انتريه', { sofas: '', chairs: '2' })); });
  t('ترحيل انتريه القديم (نص ثابت) إلى النوع الجديد', () => { const keep = getConfig(); setConfig({ styles: keep.styles, categories: keep.categories.map(c => c.id === 'entree' ? { id: 'entree', name: 'انتريه', kind: 'fixed', text: '2 كنبة + 2 كرسي + ترابيزة' } : c) }); eq(getConfig().categories.find(c => c.id === 'entree').kind, 'entree'); setConfig(keep); });
  t('نيش 5 ضلف مرفوض', () => th(() => normalize('نيش', { doors: 5 })));
  t('نوم بلا مشتملات مرفوض', () => th(() => normalize('نوم', { style: 'مودرن', includes: {} })));
  t('أطفال: سرير واحد أو سريران', () => { const one = normalize('أطفال', { wardrobeType: 'ضلفة', includes: { bed: { count: '1', types: ['سحارة', ''] } } }); eq(one.specs.includes.bed.types.length, 1); eq(one.lines[1].text, 'سرير (سحارة)'); th(() => normalize('أطفال', { includes: { bed: { count: '1', types: ['', 'ملل'] } } })); th(() => normalize('أطفال', { includes: { bed: { count: '3', types: ['سحارة', 'ملل'] } } })); eq(normalize('أطفال', { includes: { bed: { count: '2', types: ['سحارة', 'ملل'] } } }).lines[1].text, '2 سرير (سحارة، ملل)'); });
  t('أطفال: سريران بنوعين', () => { th(() => normalize('أطفال', { wardrobeType: 'ضلفة', includes: { bed: { types: ['سحارة', ''] } } })); eq(normalize('أطفال', { includes: { bed: { types: ['سحارة', 'ملل'] } } }).specs.includes.bed.types.length, 2); });
  t('نوم: سرير بأكثر من نوع', () => { const d = normalize('نوم', { style: 'كلاسيك', wardrobeType: 'ضلفة', includes: { bed: { types: ['ملل', 'ميكانيزم'] } } }).description; eq(d.includes('سرير (ميكانيزم، ملل)'), true); });
  t('نوم: السرير القديم بنوع واحد (نص) ما زال يعمل', () => eq(normalize('نوم', { style: 'كلاسيك', includes: { bed: { type: 'سحارة' } } }).description.includes('سرير (سحارة)'), true));
  t('نوم: السرير بلا نوع يُرفض', () => th(() => normalize('نوم', { style: 'كلاسيك', includes: { bed: { types: [] } } })));
  t('أطفال: كل سرير يقبل أكثر من نوع', () => eq(normalize('أطفال', { includes: { bed: { count: '2', types: [['ميكانيزم', 'ملل'], ['سحارة']] } } }).description.includes('2 سرير (ميكانيزم + ملل، سحارة)'), true));
  const good = { app: 'workshop-system', schemaVersion: 1, stores: Object.fromEntries(STORE_NAMES.map(n => [n, []])) };
  t('نسخة سليمة تُقبل', () => validateBackup(good));
  t('إصدار أحدث مرفوض', () => th(() => validateBackup({ ...good, schemaVersion: 2 })));
  t('ملف تالف مرفوض', () => { th(() => validateBackup(null)); th(() => validateBackup({ ...good, stores: { ...good.stores, payments: 5 } })); });
  t('دفعة بمبلغ كسري في النسخة مرفوضة', () => th(() => validateBackup({ ...good, stores: { ...good.stores, payments: [{ id: 'a', amountPiastres: 1.5 }] } })));
  t('رصيد الخزينة مع القيد العكسي', () => eq(treasuryBalance(1000, [{ type: 'receipt', amountPiastres: 500 }, { type: 'expense', amountPiastres: 200 }, { type: 'reversal', sign: -1, amountPiastres: 500 }]), 800));
  t('هاتف 11 رقماً يُقبل', () => eq(normalizePhone('01114010151'), '01114010151'));
  t('هاتف بالأرقام العربية يُحوَّل', () => eq(normalizePhone('٠١١١٤٠١٠١٥١'), '01114010151'));
  t('هاتف 10 أو 12 رقماً أو بحروف يُرفض', () => { th(() => normalizePhone('0111401015')); th(() => normalizePhone('011140101512')); th(() => normalizePhone('0111401015a')); th(() => normalizePhone('')); });
  t('دفعة غير مخصصة تخفض رصيد العميل ولا تغيّر متبقي الفاتورة', () => {
    const inv = [{ id: 'i', status: 'active', invoiceDate: '2026-01-02' }], pays = [{ status: 'active', paidAt: '2026-01-03', amountPiastres: 250000, id: 'p', invoiceId: null }];
    eq(customerBalance({ id: 'c', createdAt: '2026-01-01' }, inv, { i: items }, pays), 1000000);
    eq(invoiceTotals(items, pays.filter(p => p.invoiceId === 'i')).remaining, 1250000);
  });
  t('توحيد النص العربي للبحث', () => { eq(normText('أحمد'), normText('احمد')); eq(normText('فاطمة'), normText('فاطمه')); eq(normText('٠١١'), '011'); });
  t('CRC32 القياسي', () => eq(crc32(new TextEncoder().encode('123456789')), 0xCBF43926));
  t('اسم مجلد آمن لنظام ويندوز', () => { eq(safeName('أحمد: علي/محمد?'), 'أحمد- علي-محمد-'); eq(safeName('..'), 'بدون اسم'); });
  t('ملفات مجلد العميل', () => {
    const st = Object.fromEntries(STORE_NAMES.map(n => [n, []]));
    st.customers = [{ id: 'c1aaaaaa', name: 'حاتم أشرف', phone: '01111111111', createdAt: '2026-01-01' }, { id: 'c2bbbbbb', name: 'حاتم أشرف', phone: '01111111111', createdAt: '2026-01-01' }];
    st.invoices = [{ id: 'i1cccccc', customerId: 'c1aaaaaa', status: 'active', invoiceDate: '2026-02-01' }];
    st.invoiceItems = [{ invoiceId: 'i1cccccc', lineNo: 1, qty: 1, unitPricePiastres: 100000 }];
    st.payments = [{ id: 'p1', invoiceId: 'i1cccccc', customerId: 'c1aaaaaa', status: 'active', paidAt: '2026-02-02', amountPiastres: 30000 }, { id: 'p2', invoiceId: null, customerId: 'c1aaaaaa', status: 'active', paidAt: '2026-02-03', amountPiastres: 5000 }];
    st.auditLogs = [{ id: 'a', refId: 'p1' }];
    const f = buildCustomerFiles(st), paths = f.map(x => x.path);
    eq(paths.includes('العملاء/حاتم أشرف - 01111111111/بيانات العميل.json'), true);
    eq(paths.some(p => p.endsWith('/الفواتير/فاتورة 2026-02-01 i1cccccc.json')), true);
    eq(paths.some(p => p.endsWith('دفعات غير مخصصة.json')), true);
    eq(paths.some(p => p.endsWith('سجل التدقيق.json')), true);
    eq(paths.filter(p => p.endsWith('بيانات العميل.json')).length, 2);
    eq(new Set(paths.filter(p => p.endsWith('بيانات العميل.json'))).size, 2);
    const csv = f.find(x => x.path.endsWith('كشف الحساب.csv') && x.path.includes('01111111111/')).text;
    eq(csv.includes('650.00') || csv.includes('1000.00'), true);
    eq(makeZip(f).size > 100, true);
  });
  t('تنسيق المبالغ بأرقام لاتينية بلا كسور صفرية', () => { eq(formatEGP(300000), '3,000 ج.م'); eq(formatEGP(300050), '3,000.50 ج.م'); eq(formatEGP(5), '0.05 ج.م'); eq(formatEGP(0), '0 ج.م'); eq(formatEGP(123456789), '1,234,567.89 ج.م'); });
  t('تنسيق التاريخ', () => { eq(formatDate('2026-11-14'), '14 / 11 / 2026'); eq(formatDate('2026-11-14T10:00:00Z'), '14 / 11 / 2026'); eq(formatDate(''), '—'); });
  t('قسم واستايل جديدان من الإعدادات', () => {
    const cfg = getConfig(); setConfig({ styles: ['مودرن', 'موضة 2027'], categories: [...cfg.categories, { id: 'x', name: 'ركنة جديدة', kind: 'count', label: 'عدد القطع', min: 1, max: 5, unit: 'قطعة' }, { id: 'y', name: 'غرفة سفرة', kind: 'includes', usesStyle: true, includes: ['ترابيزة', 'كرسي'] }] });
    try {
      eq(normalize('ركنة جديدة', { value: 3 }).description, '3 قطعة'); th(() => normalize('ركنة جديدة', { value: 6 }));
      const r = normalize('غرفة سفرة', { style: 'موضة 2027', includes: { 'ترابيزة': {} } }); eq(r.lines[1], { text: 'ترابيزة', size: '' });
      th(() => normalize('غرفة سفرة', { style: 'غير موجود', includes: { 'ترابيزة': {} } }));
      th(() => normalize('نوم', { style: 'كلاسيك', wardrobeType: 'ضلفة', includes: { wardrobe: {} } }));
    } finally { setConfig(null); }
    eq(normalize('سفرة', { value: 4 }).description, '4 كراسي');
  });
  t('إجمالي الفاتورة اليدوي والعربون', () => {
    const inv = { netContractPiastres: 500000 }, x = invoiceTotals(items, [{ status: 'active', amountPiastres: 100000 }], inv);
    eq([x.net, x.paid, x.remaining, x.credit], [500000, 100000, 400000, 0]);
    eq(invoiceTotals([], [], inv).net, 500000); eq(invoiceTotals(items, []).net, 1250000);
  });
  t('كشف الحساب يستخدم إجمالي الفاتورة اليدوي', () => {
    const s = customerStatement({ id: 'c', createdAt: '2026-01-01' }, [{ id: 'i', status: 'active', invoiceDate: '2026-01-02', netContractPiastres: 500000 }], { i: items }, [{ status: 'active', paidAt: '2026-01-02', amountPiastres: 100000, id: 'p' }]);
    eq(s.map(r => r.balance), [500000, 400000]);
  });
  t('الكلمة ضلفة في التحقق', () => { eq(normalize('نوم', { style: 'مودرن', wardrobeType: 'ضلفة', includes: { wardrobe: {} } }).description.includes('دولاب (ضلفة)'), true); th(() => normalize('نوم', { style: 'مودرن', wardrobeType: 'ضرفة', includes: { wardrobe: {} } })); });
  t('قص منطقة الطباعة على A4', () => {
    const s = { x: 10, y: 60, w: 190, h: 187 };
    eq(resizeBox(s, 'e', 50, 0).w, 200); eq(resizeBox(s, 'w', -50, 0), { x: 0, y: 60, w: 200, h: 187 });
    eq(resizeBox(s, 'n', 0, 500).h, 40); eq(resizeBox(s, 'move', 500, 0).x, 20); eq(resizeBox(s, 'se', 5, 5), { x: 10, y: 60, w: 195, h: 192 });
    eq(marginsOf(boxFromMargins({ top: 60, bottom: 50, left: 10, right: 10 })), { top: 60, bottom: 50, left: 10, right: 10 });
    eq(fitBox({ x: 0, y: 0, w: 10, h: 10 }).w, 40);
  });
  t('أبعاد A4 بالسنتيمتر', () => { eq([cm(PAGE_W), cm(PAGE_H)], [21, 29.7]); eq([cm(60), cm(55)], [6, 5.5]); eq([toMm('29.7'), toMm('0.3'), toMm('6')], [297, 3, 60]); });
  /* ===== نظام قوالب الطباعة ===== */
  t('المبلغ بالحروف: مائة وثلاثة آلاف جنيه', () => eq(amountInWords(10300000), 'مائة وثلاثة آلاف جنيه فقط لا غير'));
  t('المبلغ بالحروف: جنيه وقروش وحالات خاصة', () => { eq(amountInWords(100), 'جنيه واحد فقط لا غير'); eq(amountInWords(200), 'جنيهان فقط لا غير'); eq(amountInWords(300), 'ثلاثة جنيهات فقط لا غير'); eq(amountInWords(5050), 'خمسون جنيه وخمسون قرش فقط لا غير'); eq(amountInWords(20000000), 'مائتا ألف جنيه فقط لا غير'); });
  t('تفقيط الأعداد الكبيرة', () => { eq(numberInWords(2000), 'ألفان'); eq(numberInWords(11000), 'أحد عشر ألف'); eq(numberInWords(1500000), 'مليون وخمسمائة ألف'); });
  t('QR: أبعاد وأنماط الكشف صحيحة', () => { const m = qrMatrix('https://wa.me/201114010151'); eq([m.length, m[0].length], [25, 25]); eq([m[0][0], m[0][6], m[6][0], m[3][3], m[1][1]], [true, true, true, true, false]); });
  t('QR: نص عربي طويل وإصدار أعلى + رفض النص الفارغ والطويل جداً', () => { eq(qrMatrix('ورشة المنتصر لتصنيع الموبيليا الحديثة - 01155589159').length >= 33, true); let a = 0, b = 0; try { qrMatrix(''); } catch { a = 1; } try { qrMatrix('x'.repeat(400)); } catch { b = 1; } eq([a, b], [1, 1]); });
  t('بنية PDF صحيحة (xref وصفحتان)', () => {
    const b = pdfFromJpegs([{ data: new Uint8Array([255, 216, 255, 217]), w: 10, h: 10 }, { data: new Uint8Array([255, 216, 255, 217]), w: 10, h: 10 }]), s = new TextDecoder('latin1').decode(b);
    eq(s.startsWith('%PDF-1.4'), true); eq(s.trimEnd().endsWith('%%EOF'), true); eq(s.includes('/Count 2'), true);
    const off = Number(/startxref\n(\d+)/.exec(s)[1]); eq(s.slice(off, off + 4), 'xref');
    const entries = [...s.slice(off).matchAll(/(\d{10}) 00000 n/g)].map(m => Number(m[1])); eq(entries.length, 8);
    entries.forEach((o, i) => eq(s.slice(o, o + String(i + 1).length + 6), `${i + 1} 0 obj`));
  });
  return out;
}
if (typeof document !== 'undefined') {
  const ul = document.getElementById('r');
  const show = (list) => list.forEach(([n, ok, m]) => { const li = document.createElement('li'); li.textContent = `${ok ? '✔' : '✘'} ${n}${m ? ' — ' + m : ''}`; ul.append(li); });
  const res = runTests(); show(res);
  runRepositoryTests().then((more) => { show(more); res.push(...more); }, (e) => { res.push(['تشغيل اختبارات قاعدة البيانات', false, e.message]); show(res.slice(-1)); })
    .finally(() => { document.title = res.every(r => r[1]) ? 'كل الاختبارات نجحت' : 'فشل اختبار'; });
} else { const r = runTests(); r.forEach(x => console.log(x[1] ? 'PASS' : 'FAIL', x[0], x[2] || '')); process.exit(r.every(x => x[1]) ? 0 : 1); }
