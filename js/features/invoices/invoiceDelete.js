import {el} from '../../core/dom.js';
import {deleteInvoice, purgeInvoice} from '../../infrastructure/repositories/invoiceRepository.js';
import {formatEGP, formatDate} from '../../core/formatters.js';
import {toast, openModal, closeModal} from '../../ui/ui.js';

const lab = (t, i) => el('label', { className: 'f' }, t + ' ', i);
const CONFIRM_WORD = 'حذف';

const option = (group, val, title, hint, on) => {
  const radio = el('input', { type: 'radio', name: group, value: val, checked: on });
  return el('label', { className: 'del-opt' }, radio, el('span', {}, el('b', { textContent: title }), el('small', { textContent: hint })));
};

/**
 * نافذة حذف فاتورة (مشتركة بين قائمة الفواتير وملف العميل). نوعان:
 *  - حذف مع سجل: سبب إلزامي، وإن كانت عليها دفعات يُسأل عن مصيرها، وتبقى نسخة في سجل التدقيق.
 *  - حذف نهائي بلا أثر: يمسح الفاتورة وكل حساباتها من النظام ومن Google Sheet كأنها لم تكن (تأكيد بكتابة كلمة).
 * onDone تُستدعى بعد نجاح الحذف.
 */
function openDeleteInvoice(inv, customerName, t, onDone) {
  const hasPaid = t.paid > 0;
  const why = el('input', { placeholder: 'سبب الحذف (مطلوب)', autocomplete: 'off' });
  const confirmInput = el('input', { placeholder: `اكتب كلمة: ${CONFIRM_WORD}`, autocomplete: 'off' });
  const err = el('div', { className: 'err' });

  const kinds = el('div', { className: 'del-opts' },
    option('deltype', 'logged', 'حذف مع الاحتفاظ بسجل', 'تبقى نسخة كاملة منها في سجل التدقيق، ويمكنك ترك دفعاتها رصيداً للعميل أو ردّها.', true),
    option('deltype', 'purge', 'حذف نهائي بلا أي أثر', 'تُمسح الفاتورة مع بنودها ودفعاتها وقيودها في الخزينة ونسخها المطبوعة وسجل تدقيقها، من النظام ومن Google Sheet، كأنها لم تكن.', false));

  const paymentChoice = hasPaid ? el('div', { className: 'del-opts' }, el('p', { textContent: `على هذه الفاتورة دفعات بقيمة ${formatEGP(t.paid)}. ماذا تفعل بها؟` }),
    option('delmode', 'credit', 'تبقى رصيداً دائناً للعميل', 'المبلغ يبقى في الخزينة ويُسجَّل للعميل على حسابه (مناسب لو ستُنشأ له فاتورة بديلة).', true),
    option('delmode', 'refund', 'ردّ المبلغ للعميل', 'تُلغى الدفعات بقيد عكسي وتنقص الخزينة بقيمتها.', false)) : '';
  const loggedPart = el('div', {}, paymentChoice, lab('سبب الحذف', why));

  const purgePart = el('div', {},
    el('p', { className: 'err', textContent: (hasPaid ? `الدفعات المسجلة (${formatEGP(t.paid)}) ستُمسح أيضاً من الخزينة وحساب العميل. ` : '') + 'لا يمكن التراجع ولا يبقى أي سجل بها.' }),
    lab(`للتأكيد اكتب كلمة «${CONFIRM_WORD}»`, confirmInput));
  purgePart.style.display = 'none';

  const ok = el('button', { className: 'btn danger', type: 'submit', textContent: 'حذف الفاتورة نهائياً' });
  const form = el('form', {}, el('p', { textContent: `الفاتورة: «${customerName || '—'}» بتاريخ ${formatDate(inv.invoiceDate)} وإجماليها ${formatEGP(t.net)}.` }),
    kinds, loggedPart, purgePart, err,
    el('div', { className: 'actions' }, ok, el('button', { className: 'btn light', type: 'button', textContent: 'إلغاء', onclick: closeModal })));

  const isPurge = () => form.elements.deltype.value === 'purge';
  // يتفاعل مع تبديل نوع الحذف فقط: أي حدث change آخر (مثل فقدان التركيز من حقل التأكيد) لا يجوز أن يلمس الزر
  // لأن استبدال نصه بين الضغط والرفع يُضيّع النقرة.
  form.addEventListener('change', (e) => {
    if (e.target.name !== 'deltype') return;
    loggedPart.style.display = isPurge() ? 'none' : '';
    purgePart.style.display = isPurge() ? '' : 'none';
    const label = isPurge() ? 'حذف نهائي بلا أثر' : 'حذف الفاتورة نهائياً';
    if (ok.textContent !== label) ok.textContent = label;
    err.textContent = '';
  });

  form.onsubmit = async (e) => {
    e.preventDefault(); err.textContent = ''; ok.disabled = true;
    try {
      if (isPurge()) {
        if (confirmInput.value.trim() !== CONFIRM_WORD) throw new Error(`اكتب كلمة «${CONFIRM_WORD}» للتأكيد`);
        await purgeInvoice(inv.id);
        toast('تم مسح الفاتورة نهائياً بلا أثر');
      } else {
        await deleteInvoice(inv.id, why.value, hasPaid ? form.elements.delmode.value : 'credit');
        toast('تم حذف الفاتورة');
      }
      closeModal(); onDone?.();
    } catch (x) { err.textContent = x.message; ok.disabled = false; }
  };
  openModal('حذف فاتورة', el('div', { className: 'modal-body' }, form)); why.focus();
}

export {openDeleteInvoice};
