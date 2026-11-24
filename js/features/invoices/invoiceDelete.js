import { el } from '../../core/dom.js';
import { deleteInvoice } from '../../infrastructure/repositories/invoiceRepository.js';
import { formatEGP, formatDate } from '../../core/formatters.js';
import { toast, openModal, closeModal } from '../../ui/ui.js';

const lab = (t, i) => el('label', { className: 'f' }, t + ' ', i);

/** نافذة حذف فاتورة (مشتركة بين قائمة الفواتير وملف العميل): سبب إلزامي، وإن كانت عليها دفعات يُسأل عن مصيرها. onDone تُستدعى بعد نجاح الحذف. */
export function openDeleteInvoice(inv, customerName, t, onDone) {
  const hasPaid = t.paid > 0, why = el('input', { placeholder: 'سبب الحذف (مطلوب)', autocomplete: 'off' }), err = el('div', { className: 'err' });
  const mk = (val, title, hint, on) => { const r = el('input', { type: 'radio', name: 'delmode', value: val, checked: on }); return el('label', { className: 'del-opt' }, r, el('span', {}, el('b', { textContent: title }), el('small', { textContent: hint }))); };
  const opts = hasPaid ? el('div', { className: 'del-opts' }, el('p', { textContent: `على هذه الفاتورة دفعات بقيمة ${formatEGP(t.paid)}. ماذا تفعل بها؟` }),
    mk('credit', 'تبقى رصيداً دائناً للعميل', 'المبلغ يبقى في الخزينة ويُسجَّل للعميل على حسابه (مناسب لو ستُنشأ له فاتورة بديلة).', true),
    mk('refund', 'ردّ المبلغ للعميل', 'تُلغى الدفعات بقيد عكسي وتنقص الخزينة بقيمتها.', false)) : '';
  const ok = el('button', { className: 'btn danger', type: 'submit', textContent: 'حذف الفاتورة نهائياً' });
  const form = el('form', {}, el('p', { textContent: `ستُحذف فاتورة «${customerName || '—'}» بتاريخ ${formatDate(inv.invoiceDate)} وإجماليها ${formatEGP(t.net)} مع بنودها ونسخها المطبوعة. لا يمكن التراجع من داخل النظام (تبقى نسخة منها في سجل التدقيق).` }), opts, lab('سبب الحذف', why), err,
    el('div', { className: 'actions' }, ok, el('button', { className: 'btn light', type: 'button', textContent: 'إلغاء', onclick: closeModal })));
  form.onsubmit = async e => {
    e.preventDefault(); err.textContent = ''; ok.disabled = true;
    try { await deleteInvoice(inv.id, why.value, hasPaid ? form.elements.delmode.value : 'credit'); closeModal(); toast('تم حذف الفاتورة'); onDone?.(); }
    catch (x) { err.textContent = x.message; ok.disabled = false; }
  };
  openModal('حذف فاتورة', el('div', { className: 'modal-body' }, form)); why.focus();
}
