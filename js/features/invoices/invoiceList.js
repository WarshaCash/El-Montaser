// شاشة جميع الفواتير.
import { el } from '../../core/dom.js';
import { formatEGP } from '../../core/formatters.js';
import { normText } from '../../core/validators.js';
import { invoiceTotals } from '../../domain/accounting.js';
import { navigate } from '../../shell/router.js';
import { isSettled, loadAll } from '../quickAccess/quick.js';
import { openDeleteInvoice } from './invoiceDelete.js';

/** جميع الفواتير: صف واحد لكل عميل منعاً للتشتت. العميل صاحب فاتورة واحدة يظهر بفاتورته، ومن له أكثر من فاتورة يُفتح له حسابه (ملف العميل). */
export async function renderList(v) {
  const d = await loadAll(), { c: custs, i: invs, it: items, p: pays } = d;
  if (!invs.length) { v.append(el('div', { className: 'card empty', textContent: 'لا توجد فواتير بعد.' })); return; }
  const cm = Object.fromEntries(custs.map(c => [c.id, c])), settled = new Set(custs.filter(c => isSettled(d, c)).map(c => c.id)); // المسدَّدون بالكامل في «الأرشيف»
  const archLink = el('a', { href: '#/archive' });
  invs.sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate) || (b.createdAt || '').localeCompare(a.createdAt || ''));
  const q = el('input', { type: 'search', className: 'wide', placeholder: 'ابحث باسم العميل أو رقم هاتفه…' }), info = el('p', { className: 'hint' }), holder = el('div');
  const draw = () => {
    const s = normText(q.value), groups = new Map();
    for (const i of invs) { if (settled.has(i.customerId)) continue; const c = cm[i.customerId] || {}; if (s && !normText(c.name || '').includes(s) && !(c.phone || '').includes(s)) continue; if (!groups.has(i.customerId)) groups.set(i.customerId, []); groups.get(i.customerId).push(i); }
    const rows = [...groups.entries()];
    const shown = rows.reduce((n, [, l]) => n + l.length, 0);
    info.replaceChildren(`عدد العملاء: ${rows.length} — إجمالي الفواتير: ${shown}`, ...(settled.size ? [' — ', Object.assign(archLink, { textContent: `${settled.size} عميل مسدَّد بالكامل في الأرشيف` })] : []));
    holder.replaceChildren(rows.length ? el('table', {}, el('thead', {}, el('tr', {}, ...['التاريخ', 'العميل', 'الهاتف', 'صافي التعاقد', 'المدفوع', 'المتبقي', ''].map(x => el('th', { textContent: x })))),
      el('tbody', {}, ...rows.map(([cid, list]) => {
        const c = cm[cid] || {}, ts = list.map(i => invoiceTotals(items.filter(x => x.invoiceId === i.id), pays.filter(p => p.invoiceId === i.id), i)), sum = k => ts.reduce((a, t) => a + t[k], 0), many = list.length > 1, one = list[0];
        const nameCell = many ? el('td', {}, el('a', { href: `#/customer?id=${cid}`, textContent: c.name || '—' }), ' ', el('span', { className: 'chip', textContent: `${list.length} فواتير` })) : el('td', { textContent: c.name || '—' });
        const acts = many ? el('a', { className: 'btn', href: `#/customer?id=${cid}`, textContent: 'فتح الحساب' })
          : el('div', { className: 'acts' }, el('a', { className: 'btn', href: `#/invoice?id=${one.id}`, textContent: 'فتح' }), el('a', { className: 'btn', href: `#/invoice/edit?id=${one.id}`, textContent: 'تعديل' }),
              el('button', { className: 'btn danger', type: 'button', textContent: 'حذف', onclick: () => openDeleteInvoice(one, c.name, ts[0], () => { invs.splice(invs.indexOf(one), 1); if (!invs.length) navigate(); else draw(); }) }));
        return el('tr', {}, el('td', { textContent: one.invoiceDate }), nameCell, el('td', { textContent: c.phone || '—' }), el('td', { textContent: formatEGP(sum('net')) }), el('td', { textContent: formatEGP(sum('paid')) }), el('td', { textContent: formatEGP(sum('remaining')) }), el('td', {}, acts));
      })))
      : el('div', { className: 'empty', textContent: s ? 'لا توجد فواتير مطابقة للبحث.' : 'لا توجد فواتير عليها مستحقات — كل العملاء مسدَّدون بالكامل وهم في الأرشيف.' }));
  };
  q.oninput = draw; v.append(el('div', { className: 'card' }, q, info, holder)); draw(); q.focus();
}

