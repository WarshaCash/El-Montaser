import { el } from '../../core/dom.js';
import { loadAll, custData, balText, openPalette, openCollect, isSettled } from '../quickAccess/quick.js';
import { icon } from '../../ui/ui.js';
import { openDeleteInvoice } from '../invoices/invoiceDelete.js';
import { navigate } from '../../shell/router.js';
import { invoiceTotals } from '../../domain/accounting.js';
import { formatEGP, formatDate } from '../../core/formatters.js';

const tbl = (heads, rows, empty) => rows.length ? el('table', {}, el('thead', {}, el('tr', {}, ...heads.map(h => el('th', { textContent: h })))), el('tbody', {}, ...rows.map(r => el('tr', {}, ...r.map(c => c instanceof Node ? el('td', {}, c) : el('td', { textContent: String(c) })))))) : el('div', { className: 'empty', textContent: empty });
const kpi = (t, n) => el('div', { className: 'card kpi' }, el('span', { textContent: t }), el('b', { textContent: n }));
const link = (href, t, cls = '') => el('a', { className: cls, href, textContent: t });
const btn = (t, f, cls = 'btn sm') => el('button', { className: cls, type: 'button', textContent: t, onclick: f });
const hero = mode => el('button', { className: 'hero-search', type: 'button', onclick: () => openPalette(mode) }, icon('M21 21l-4.3-4.3M10.5 18a7.5 7.5 0 110-15 7.5 7.5 0 010 15z'), el('span', { textContent: 'ابحث عن عميل بالاسم أو رقم الهاتف…' }), el('kbd', { textContent: mode === 'collect' ? 'F2' : 'Ctrl K' }));
const chipFor = rem => el('span', { className: 'chip ' + (rem > 0 ? 'due' : 'ok'), textContent: rem > 0 ? `متبقي ${formatEGP(rem)}` : 'مسددة' });

export async function renderDashboard(v) {
  const d = await loadAll(), rows = d.c.map(c => ({ c, ...custData(d, c) })), due = rows.filter(r => r.balance > 0).sort((a, b) => b.balance - a.balance);
  const day = new Date().toISOString().slice(0, 10), todayTotal = d.p.filter(p => p.status === 'active' && p.paidAt === day).reduce((s, p) => s + p.amountPiastres, 0);
  const tile = (t, s, href, f) => el('a', { className: 'tile', href: href || '#', onclick: f ? e => { e.preventDefault(); f(); } : null }, el('b', { textContent: t }), el('span', { textContent: s }));
  const cname = Object.fromEntries(d.c.map(c => [c.id, c.name])), latest = [...d.i].sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate) || b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
  v.append(hero('search'),
    el('div', { className: 'tiles' }, tile('فاتورة جديدة', 'Alt+N', '#/invoices/new'), tile('تحصيل دفعة', 'F2', null, () => openPalette('collect')), tile('العملاء', 'القائمة والبحث', '#/customers'), tile('المصروفات', 'تسجيل وطباعة الشهر', '#/expenses'), tile('الخزينة', 'الرصيد والحركة', '#/treasury')),
    el('div', { className: 'grid' }, kpi('إجمالي المستحق على العملاء', formatEGP(due.reduce((s, r) => s + r.balance, 0))), kpi('تحصيل اليوم', formatEGP(todayTotal)), kpi('العملاء', String(d.c.length)), kpi('الفواتير', String(d.i.length))),
    el('div', { className: 'cols2' },
      el('div', { className: 'card' }, el('h3', { textContent: 'أعلى المديونيات' }), tbl(['العميل', 'المستحق', ''], due.slice(0, 6).map(r => [link(`#/customer?id=${r.c.id}`, r.c.name), formatEGP(r.balance), btn('تحصيل', () => openCollect(r.c.id))]), 'لا توجد مديونيات.')),
      el('div', { className: 'card' }, el('h3', { textContent: 'آخر الفواتير' }), tbl(['التاريخ', 'العميل', 'الإجمالي', ''], latest.map(i => [formatDate(i.invoiceDate), cname[i.customerId] || '—', formatEGP(i.netContractPiastres), link(`#/invoice?id=${i.id}`, 'فتح', 'btn sm')]), 'لا توجد فواتير بعد.'))));
}

/** ملف العميل: كل ما يخصه في صفحة واحدة. */
export async function renderProfile(v, params) {
  const d = await loadAll(), c = d.c.find(x => x.id === params.get('id')); if (!c) throw new Error('العميل غير موجود');
  const { inv, pay, balance } = custData(d, c), act = inv.filter(i => i.status === 'active'), pays = pay.filter(p => p.status === 'active');
  const net = act.reduce((s, i) => s + i.netContractPiastres, 0), paid = pays.reduce((s, p) => s + p.amountPiastres, 0);
  const sorted = [...inv].sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate));
  v.append(el('div', { className: 'card inv-bar' }, el('div', { className: 'inv-info' }, el('h2', { className: 'pname', textContent: c.name }), el('span', { className: 'pal-sub', textContent: c.phone || '' }), el('span', { className: 'chip ' + (balance > 0 ? 'due' : 'ok'), textContent: balText(balance) }), ...(isSettled(d, c) ? [link('#/archive', 'في الأرشيف', 'chip')] : [])),
      el('div', { className: 'actions' }, btn('تحصيل دفعة', () => openCollect(c.id), 'btn'), link(`#/invoices/new?customer=${c.id}`, 'فاتورة جديدة', 'btn'), link(`#/statement?id=${c.id}`, 'كشف الحساب', 'btn light'), link(`#/customers?edit=${c.id}`, 'تعديل البيانات', 'btn light'))),
    el('div', { className: 'grid' }, kpi('إجمالي التعاقدات', formatEGP(net)), kpi('إجمالي المدفوع', formatEGP(paid)), kpi('الرصيد', balance >= 0 ? formatEGP(balance) : `دائن ${formatEGP(-balance)}`), kpi('عدد الفواتير', String(inv.length))),
    el('div', { className: 'card' }, el('h3', { textContent: 'الفواتير' }), tbl(['التاريخ', 'الإجمالي', 'المدفوع', 'الحالة', ''], sorted.map(i => { const t = invoiceTotals(d.by[i.id] || [], pay.filter(p => p.invoiceId === i.id), i);
      return [formatDate(i.invoiceDate), formatEGP(t.net), formatEGP(t.paid), chipFor(t.remaining), el('div', { className: 'acts' }, link(`#/invoice?id=${i.id}`, 'فتح', 'btn sm'), link(`#/invoice/edit?id=${i.id}`, 'تعديل', 'btn sm light'), btn('حذف', () => openDeleteInvoice(i, c.name, t, navigate), 'btn sm danger'))]; }), 'لا توجد فواتير.')),
    el('div', { className: 'card' }, el('h3', { textContent: 'آخر الدفعات' }), tbl(['التاريخ', 'المبلغ', 'الطريقة', 'على'], [...pays].sort((a, b) => b.paidAt.localeCompare(a.paidAt)).slice(0, 10).map(p => [formatDate(p.paidAt), formatEGP(p.amountPiastres), p.method, p.invoiceId ? link(`#/invoice?id=${p.invoiceId}`, 'فاتورة') : 'حساب العميل']), 'لا توجد دفعات.')));
}

/** شاشة التحصيل: بحث ثم مربع التحصيل. الروابط القديمة ?customer= تفتح المربع مباشرة. */
export async function renderCollectPage(v, params) {
  const d = await loadAll(), due = d.c.map(c => ({ c, ...custData(d, c) })).filter(r => r.balance > 0).sort((a, b) => b.balance - a.balance);
  v.append(hero('collect'), el('div', { className: 'card' }, el('h3', { textContent: 'العملاء المستحق عليهم' }), tbl(['العميل', 'الهاتف', 'المستحق', ''], due.map(r => [link(`#/customer?id=${r.c.id}`, r.c.name), r.c.phone || '—', formatEGP(r.balance), btn('تحصيل', () => openCollect(r.c.id))]), 'لا توجد مديونيات.')));
  if (params.get('customer')) { history.replaceState(null, '', '#/collect'); openCollect(params.get('customer'), params.get('invoice')); }
}
