import {el} from '../../core/dom.js';
import {loadAll, custData, isSettled, balText} from '../quickAccess/quick.js';
import {invoiceTotals} from '../../domain/accounting.js';
import {formatEGP, formatDate} from '../../core/formatters.js';
import {normText} from '../../core/validators.js';

/** الأرشيف: العملاء المسدَّدون بالكامل. يُنقل العميل إليه تلقائياً عند سداد كل مستحقاته، ويعود إلى «جميع الفواتير» تلقائياً إذا صار عليه مستحق من جديد (مثلاً فاتورة جديدة). */
async function renderArchive(v) {
  const d = await loadAll();
  const rows = d.c.filter(c => isSettled(d, c)).map(c => {
    const { inv, pay, balance } = custData(d, c), act = inv.filter(i => i.status === 'active'), ap = pay.filter(p => p.status === 'active');
    const net = act.reduce((s, i) => s + invoiceTotals(d.by[i.id] || [], [], i).net, 0), paid = ap.reduce((s, p) => s + p.amountPiastres, 0);
    return { c, balance, n: act.length, net, paid, last: ap.map(p => p.paidAt).sort().pop() || '' };
  }).sort((a, b) => b.last.localeCompare(a.last));
  const q = el('input', { type: 'search', className: 'wide', placeholder: 'ابحث في الأرشيف بالاسم أو رقم الهاتف…' }), info = el('p', { className: 'hint' }), holder = el('div');
  const draw = () => {
    const s = normText(q.value), list = rows.filter(r => !s || normText(r.c.name).includes(s) || (r.c.phone || '').includes(s));
    info.textContent = s ? `النتائج: ${list.length} من ${rows.length} عميل مؤرشف` : `عدد العملاء في الأرشيف: ${rows.length}`;
    holder.replaceChildren(list.length ? el('table', {}, el('thead', {}, el('tr', {}, ...['العميل', 'الهاتف', 'عدد الفواتير', 'إجمالي التعاقدات', 'المدفوع', 'آخر دفعة', 'الحساب', ''].map(x => el('th', { textContent: x })))),
      el('tbody', {}, ...list.map(r => el('tr', {}, el('td', {}, el('a', { href: `#/customer?id=${r.c.id}`, textContent: r.c.name })), el('td', { textContent: r.c.phone || '—' }), el('td', { textContent: String(r.n) }), el('td', { textContent: formatEGP(r.net) }), el('td', { textContent: formatEGP(r.paid) }),
        el('td', { textContent: r.last ? formatDate(r.last) : '—' }), el('td', {}, el('span', { className: 'chip ok', textContent: r.balance < 0 ? balText(r.balance) : 'مسدَّد بالكامل' })),
        el('td', {}, el('div', { className: 'acts' }, el('a', { className: 'btn', href: `#/customer?id=${r.c.id}`, textContent: 'فتح الحساب' }), el('a', { className: 'btn light', href: `#/invoices/new?customer=${r.c.id}`, textContent: 'فاتورة جديدة' })))))))
      : el('div', { className: 'empty', textContent: rows.length ? 'لا توجد نتائج مطابقة للبحث.' : 'لا يوجد عملاء مسدَّدون بالكامل بعد.' }));
  };
  q.oninput = draw;
  v.append(el('div', { className: 'card' }, el('p', { className: 'hint', textContent: 'ينتقل العميل إلى هنا تلقائياً عندما تنتهي كل مبالغه المستحقة، ويعود إلى «جميع الفواتير» تلقائياً عند إضافة فاتورة جديدة عليها مستحقات.' }), q, info, holder));
  draw();
}

export {renderArchive};
