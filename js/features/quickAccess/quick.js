import { el } from '../../core/dom.js';
import { getAll } from '../../infrastructure/db/store.js';
import { addPayment } from '../../infrastructure/repositories/ledgerRepository.js';
import { invoiceTotals, customerBalance, validatePayment } from '../../domain/accounting.js';
import { parsePiastres, formatEGP, formatDate, uid } from '../../core/formatters.js';
import { normText, toLatinDigits } from '../../core/validators.js';
import { openModal, closeModal, isModalOpen, toast } from '../../ui/ui.js';
import { navigate } from '../../shell/router.js';

export async function loadAll() {
  const [c, i, it, p] = await Promise.all([getAll('customers'), getAll('invoices'), getAll('invoiceItems'), getAll('payments')]);
  const by = {}; it.forEach(x => (by[x.invoiceId] ??= []).push(x)); return { c, i, it, p, by };
}
export function custData(d, c) {
  const inv = d.i.filter(x => x.customerId === c.id), pay = d.p.filter(x => x.customerId === c.id);
  return { inv, pay, balance: customerBalance(c, inv, d.by, pay) };
}
/** عميل مسدَّد بالكامل = له فاتورة فعّالة على الأقل ورصيده صفر أو دائن. القاعدة محسوبة دائماً (لا علم مخزَّن) فيعود العميل تلقائياً لقائمة الفواتير بمجرد وجود مستحقات عليه من جديد. */
export const isSettled = (d, c) => { const { inv, balance } = custData(d, c); return inv.some(i => i.status === 'active') && balance <= 0; };
export const balText = b => b > 0 ? `مستحق ${formatEGP(b)}` : b < 0 ? `رصيد دائن ${formatEGP(-b)}` : 'لا مستحقات';
const today = () => new Date().toISOString().slice(0, 10);
const lab = (t, i) => el('label', { className: 'f' }, t + ' ', i);
const PAGES = [['إنشاء فاتورة جديدة', '/invoices/new'], ['جميع الفواتير', '/invoices'], ['العملاء', '/customers'], ['الأرشيف', '/archive'], ['الحسابات', '/accounts'], ['الخزينة والمصروفات', '/treasury'], ['الإعدادات والنسخ الاحتياطي', '/settings']];

/** بحث سريع: عميل بالاسم/الهاتف أو شاشة. mode=collect يجعل Enter يفتح التحصيل مباشرة. */
export async function openPalette(mode = 'search') {
  const d = await loadAll();
  const input = el('input', { className: 'pal-input', autocomplete: 'off', placeholder: mode === 'collect' ? 'اكتب اسم العميل أو هاتفه للتحصيل…' : 'ابحث عن عميل بالاسم أو الهاتف، أو اكتب اسم شاشة…' });
  const list = el('div', { className: 'pal-list' }); let sel = 0, shown = [];
  const go = p => { closeModal(); location.hash = '#' + p; };
  const collect = r => { closeModal(); openCollect(r.c.id); };
  const act = r => { if (!r) return; if (r.type === 'page') go(r.p); else if (mode === 'collect') collect(r); else go(`/customer?id=${r.c.id}`); };
  const small = (t, f) => el('button', { className: 'btn sm light', type: 'button', textContent: t, onclick: e => { e.stopPropagation(); f(); } });
  const row = (r, i) => r.type === 'page'
    ? el('div', { className: 'pal-row' + (i === sel ? ' sel' : ''), onclick: () => act(r) }, el('div', { className: 'pal-main' }, el('b', { textContent: r.t }), el('span', { className: 'pal-sub', textContent: 'فتح الشاشة' })))
    : el('div', { className: 'pal-row' + (i === sel ? ' sel' : ''), onclick: () => act(r) }, el('div', { className: 'pal-main' }, el('b', { textContent: r.c.name }), el('span', { className: 'pal-sub', textContent: r.c.phone || '' })),
        el('span', { className: 'chip ' + (r.balance > 0 ? 'due' : 'ok'), textContent: balText(r.balance) }),
        el('div', { className: 'acts' }, small('تحصيل', () => collect(r)), small('فاتورة', () => go(`/invoices/new?customer=${r.c.id}`)), small('الملف', () => go(`/customer?id=${r.c.id}`))));
  const draw = () => {
    const q = normText(input.value), digits = toLatinDigits(input.value).replace(/\D/g, '');
    const pages = mode === 'collect' || !q ? [] : PAGES.filter(([t]) => normText(t).includes(q)).map(([t, p]) => ({ type: 'page', t, p }));
    const cs = d.c.map(c => ({ type: 'cust', c, ...custData(d, c) })).filter(x => !q || normText(x.c.name).includes(q) || (digits && (x.c.phone || '').includes(digits)))
      .sort((a, b) => (b.balance > 0) - (a.balance > 0) || a.c.name.localeCompare(b.c.name, 'ar')).slice(0, 8);
    shown = [...pages, ...cs]; sel = Math.max(0, Math.min(sel, shown.length - 1));
    list.replaceChildren(...(shown.length ? shown.map(row) : [el('div', { className: 'empty', textContent: 'لا توجد نتائج.' })]));
    list.querySelector('.sel')?.scrollIntoView({ block: 'nearest' });
  };
  input.oninput = () => { sel = 0; draw(); };
  input.onkeydown = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, shown.length - 1); draw(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); draw(); }
    else if (e.key === 'Enter') { e.preventDefault(); act(shown[sel]); }
  };
  openModal(mode === 'collect' ? 'تحصيل دفعة — اختر العميل' : 'بحث سريع', el('div', {}, input, list), { wide: true }); input.focus(); draw();
}

/** تحصيل سريع: اكتب المبلغ واضغط Enter. الافتراضي: أقدم فاتورة بها متبقي. */
export async function openCollect(customerId, invoiceId = null) {
  const d = await loadAll(), c = d.c.find(x => x.id === customerId); if (!c) return;
  const { inv, pay, balance } = custData(d, c);
  const open = inv.filter(i => i.status === 'active').map(i => ({ i, t: invoiceTotals(d.by[i.id] || [], pay.filter(p => p.invoiceId === i.id), i) })).sort((a, b) => a.i.invoiceDate.localeCompare(b.i.invoiceDate));
  const remOf = id => id ? (open.find(x => x.i.id === id)?.t.remaining ?? 0) : Math.max(balance, 0);
  const amt = el('input', { className: 'big', placeholder: '0', inputMode: 'decimal', autocomplete: 'off' });
  const target = el('select', {}, el('option', { value: '', textContent: 'على حساب العميل' }), ...open.map(({ i, t }) => el('option', { value: i.id, textContent: `فاتورة ${formatDate(i.invoiceDate)} — متبقي ${formatEGP(t.remaining)}` })));
  target.value = invoiceId || open.find(x => x.t.remaining > 0)?.i.id || '';
  let method = 'نقدي';
  const segs = ['نقدي', 'تحويل', 'أخرى'].map(m => { const b = el('button', { className: 'seg' + (m === method ? ' on' : ''), type: 'button', textContent: m }); b.onclick = () => { method = m; segs.forEach(s => s.classList.toggle('on', s === b)); amt.focus(); }; return b; });
  const fill = el('button', { className: 'btn sm light', type: 'button', textContent: 'سدّد المتبقي', onclick: () => { const r = remOf(target.value); if (r > 0) amt.value = String(r / 100); amt.focus(); } });
  const date = el('input', { type: 'date', value: today() }), rc = el('input', { placeholder: 'رقم سند القبض (اختياري)' }), nt = el('input', { placeholder: 'ملاحظات (اختياري)' });
  const err = el('div', { className: 'err' }), btn = el('button', { className: 'btn', type: 'submit', textContent: 'تحصيل' }); let opId = uid();
  const form = el('form', {}, el('div', { className: 'segs' }, ...segs), lab('المبلغ بالجنيه', amt), el('div', { className: 'row' }, lab('على', target), fill),
    el('details', {}, el('summary', { textContent: 'تفاصيل إضافية' }), el('div', { className: 'row' }, lab('التاريخ', date), rc, nt)), err, btn);
  form.onsubmit = async e => {
    e.preventDefault(); err.textContent = ''; btn.disabled = true;
    try {
      const p = { opId, invoiceId: target.value || null, customerId: c.id, amountPiastres: parsePiastres(amt.value), paidAt: date.value, method, treasuryId: 'main', receiptNo: rc.value.trim() || null, notes: nt.value.trim() || null };
      const errs = validatePayment(p); if (errs.length) throw new Error(errs.join('، '));
      const rem = p.invoiceId ? remOf(p.invoiceId) : null;
      if (rem !== null && p.amountPiastres > rem && !confirm(`المبلغ أكبر من المتبقي على الفاتورة (${formatEGP(rem)}). سيتحول الفرق إلى رصيد دائن للعميل. هل تريد المتابعة؟`)) { btn.disabled = false; return; }
      const r = await addPayment(p); if (r.duplicate) throw new Error('هذه الدفعة سُجّلت من قبل');
      closeModal(); toast(`تم تحصيل ${formatEGP(p.amountPiastres)} من ${c.name}`); navigate();
    } catch (x) { err.textContent = x.message; btn.disabled = false; }
  };
  openModal(`تحصيل دفعة — ${c.name}`, el('div', { className: 'modal-body' }, el('div', { className: 'modal-info' }, el('span', { className: 'pal-sub', textContent: c.phone || '' }), el('span', { className: 'chip ' + (balance > 0 ? 'due' : 'ok'), textContent: balText(balance) })), form));
  amt.focus();
}

export function initShortcuts() {
  document.addEventListener('keydown', e => {
    const tag = (e.target.tagName || '').toLowerCase(), typing = ['input', 'textarea', 'select'].includes(tag) || e.target.isContentEditable;
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyK') { e.preventDefault(); openPalette(); }
    else if (e.code === 'F2') { e.preventDefault(); openPalette('collect'); }
    else if (e.altKey && e.code === 'KeyN') { e.preventDefault(); location.hash = '#/invoices/new'; }
    else if (e.code === 'Slash' && !e.shiftKey && !typing && !isModalOpen()) { e.preventDefault(); openPalette(); }
  });
}
