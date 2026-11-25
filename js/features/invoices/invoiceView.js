// شاشة عرض فاتورة واحدة (الدفعات والطباعة).

import {el} from '../../core/dom.js';
import {formatDate, formatEGP, nowISO} from '../../core/formatters.js';
import {invoiceTotals} from '../../domain/accounting.js';
import {addSnapshot} from '../../infrastructure/repositories/invoiceRepository.js';
import {get, getByIndex, getKV} from '../../infrastructure/db/store.js';
import {reverseRecord} from '../../infrastructure/repositories/ledgerRepository.js';
import {navigate} from '../../shell/router.js';
import {toast} from '../../ui/ui.js';
import {getBackupFolder, printAs, savePdfCopy} from '../archive/archive.js';
import {openCollect} from '../quickAccess/quick.js';
import {clause} from './invoiceDefaults.js';
import {getLayout, sheet} from './sheet.js';

async function renderInvoice(v, params) {
  const id = params.get('id'), inv = await get('invoices', id); if (!inv) throw new Error('الفاتورة غير موجودة');
  const [customer, items, payments, snaps, cl, layout, autoPdf] = await Promise.all([get('customers', inv.customerId), getByIndex('invoiceItems', 'invoiceId', id), getByIndex('payments', 'invoiceId', id), getByIndex('printSnapshots', 'invoiceId', id), clause(), getLayout(), getKV('settings', 'autoPdf', true)]);
  items.sort((a, b) => a.lineNo - b.lineNo); payments.sort((a, b) => a.paidAt.localeCompare(b.paidAt) || a.createdAt.localeCompare(b.createdAt)); snaps.sort((a, b) => a.version - b.version);
  const current = { customer, invoice: inv, items, payments }, t = invoiceTotals(items, payments, inv), active = payments.filter(p => p.status === 'active');
  // تُفتح كل فاتورة في وضع «عرض الفاتورة» (الجدول فقط للطباعة على الورق الجاهز)، وزر «فاتورة كاملة» متاح عند الحاجة
  let mode = 'letterhead';
  const data = current, holder = el('div'), err = el('div', { className: 'err no-print' });
  const render = () => holder.replaceChildren(sheet(data, cl, { ...layout, mode }));
  render();
  const segs = [['letterhead', 'عرض الفاتورة'], ['full', 'فاتورة كاملة']].map(([m, tx]) => { const b = el('button', { className: 'seg' + (m === mode ? ' on' : ''), type: 'button', textContent: tx }); b.onclick = () => { mode = m; segs.forEach(s => s.classList.toggle('on', s === b)); render(); }; return b; });
  // الطباعة تحفظ لقطة من الفاتورة الحالية ثم تطبع ما هو معروض
  const printBtn = el('button', { className: 'btn', type: 'button', textContent: 'طباعة', onclick: async () => {
    err.textContent = '';
    const folder = autoPdf ? await getBackupFolder(true) : null;
    try {
      snaps.push(await addSnapshot({ invoiceId: id, printedAt: nowISO(), version: snaps.length + 1, snapshot: structuredClone(current) }));
      if (autoPdf) {
        try { const r = await savePdfCopy(current, cl, folder); toast(r.where === 'folder' ? `تم حفظ نسخة PDF: ${r.path}` : `تم تنزيل نسخة PDF: ${r.name}`); }
        catch (e) { err.textContent = 'تعذّر حفظ نسخة PDF، وستستمر الطباعة: ' + e.message; }
      }
      printAs(customer?.name || 'فاتورة');
    } catch (x) { err.textContent = 'تعذّر حفظ سجل الطباعة: ' + x.message; }
  } });
  const payList = el('div', {}, ...active.map(p => el('div', { className: 'row' }, el('span', { textContent: `${formatDate(p.paidAt)} — ${formatEGP(p.amountPiastres)} — ${p.method}` }),
    el('button', { className: 'btn danger', type: 'button', textContent: 'إلغاء بقيد عكسي', onclick: async () => { const r = prompt('سبب إلغاء الدفعة (مطلوب):'); if (r === null) return; try { await reverseRecord('payment', p.id, r); navigate(); } catch (x) { err.textContent = x.message; } } }))));
  v.append(
    el('div', { className: 'card no-print inv-bar' }, el('div', { className: 'inv-info' }, el('a', { href: `#/customer?id=${inv.customerId}`, textContent: customer?.name || '—' }), el('span', { className: 'pal-sub', textContent: formatDate(inv.invoiceDate) }),
      el('span', { className: 'chip ' + (t.remaining > 0 ? 'due' : 'ok'), textContent: t.remaining > 0 ? `المتبقي ${formatEGP(t.remaining)}` : 'مسددة بالكامل' })),
      el('div', { className: 'actions' }, ...segs, printBtn, el('button', { className: 'btn', type: 'button', textContent: 'تحصيل دفعة', onclick: () => openCollect(inv.customerId, id) }), el('a', { className: 'btn light', href: `#/invoice/edit?id=${id}`, textContent: 'تعديل الفاتورة' }))),
    err,
    el('details', { className: 'card no-print' }, el('summary', { textContent: `الدفعات (${active.length})` }), active.length ? payList : el('div', { className: 'empty', textContent: 'لا توجد دفعات.' })),
    holder);
  if (params?.get('print') === '1') { history.replaceState(null, '', `#/invoice?id=${id}`); setTimeout(() => printBtn.click(), 250); }
}

export {renderInvoice};
