// شاشة إنشاء/تعديل الفاتورة (بنود + عميل + عربون). تجمع وحدات editor/ وتربط بينها.
//   customerPicker: العميل | itemBuilder: إضافة بند | itemsTable: البنود | readInvoiceForm: التحقق عند الحفظ
import { el } from '../../core/dom.js';
import { getAll } from '../../infrastructure/db/store.js';
import { loadCatalog } from '../../infrastructure/catalogStore.js';
import { saveInvoice, updateInvoice } from '../../infrastructure/repositories/invoiceRepository.js';
import { lab } from '../../ui/controls.js';
import { toast } from '../../ui/ui.js';
import { clause, today } from './invoiceDefaults.js';
import { getLayout, sheet } from './sheet.js';
import { createCustomerPicker } from './editor/customerPicker.js';
import { createItemBuilder } from './editor/itemBuilder.js';
import { itemsTable } from './editor/itemsTable.js';
import { loadInvoiceForEdit } from './editor/loadInvoiceForEdit.js';
import { readInvoiceForm } from './editor/readInvoiceForm.js';
import { piastresToInput, previewMoney } from './editor/money.js';

const PAYMENT_METHODS = ['نقدي', 'تحويل', 'أخرى'];
const TOTAL_HINT = 'يُجمع تلقائياً من أسعار البنود إن وُجدت، أو اكتب الإجمالي الكامل بنفسك (حتى بدون أسعار للبنود).';
const TOTAL_MANUAL_HINT = 'الإجمالي المكتوب يدوياً هو المعتمد. امسح الخانة ليُحسب من أسعار البنود.';

/** إنشاء فاتورة، أو تعديل فاتورة قائمة إن مُرّر id في المسار. */
export const renderNew = async (view, params) => {
  await loadCatalog();
  const editId = params?.get('id') || null;
  const [customers, priceClause, layout] = await Promise.all([getAll('customers'), clause(), getLayout()]);
  const editing = editId ? await loadInvoiceForEdit(editId) : null;
  const items = editing ? editing.items : [];

  const date = el('input', { type: 'date', value: editing ? editing.invoice.invoiceDate : today() });
  const storedTotal = editing ? editing.invoice.netContractPiastres : 0;
  // الإجمالي قابل للكتابة: يُحسب من أسعار البنود تلقائياً ما لم يكتبه المستخدم بنفسه.
  const sumOf = (list) => list.reduce((sum, item) => sum + item.qty * item.unitPricePiastres, 0);
  let manualTotal = !!editing && storedTotal > 0 && storedTotal !== sumOf(items);
  const total = el('input', {
    placeholder: 'الإجمالي بالجنيه', value: editing ? piastresToInput(storedTotal) : '', inputMode: 'decimal',
  });
  const totalNote = el('div', { className: 'grp-h no-print', textContent: TOTAL_HINT });
  const deposit = el('input', { placeholder: 'العربون بالجنيه', inputMode: 'decimal' });
  const depositMethod = el('select', {}, ...PAYMENT_METHODS.map((m) => el('option', { value: m, textContent: m })));
  const list = el('div');
  const preview = el('div', { className: 'preview' });
  const errorBox = el('div', { className: 'err no-print' });

  const picker = createCustomerPicker({
    customers, editing: editing?.invoice, paymentsLocked: !!editing?.payments.length,
    preselectId: params?.get('customer'), onChange: () => redraw(),
  });

  /** المدفوعات المعروضة في المعاينة: دفعات الفاتورة عند التعديل، وإلا العربون المكتوب (إن وُجد). */
  const previewPayments = () => {
    if (editing) return editing.payments;
    const amount = previewMoney(deposit);
    if (amount <= 0) return [];
    return [{ status: 'active', amountPiastres: amount, paidAt: date.value, method: depositMethod.value, receiptNo: null, notes: 'عربون' }];
  };

  function redraw() {
    const itemsSum = sumOf(items);
    if (!manualTotal) {
      // بلا أسعار للبنود: يبقى الإجمالي المحفوظ (فاتورة قديمة) أو الفارغ حتى يكتبه المستخدم
      const keep = editing && itemsSum === 0 ? piastresToInput(storedTotal) : '';
      total.value = itemsSum > 0 ? piastresToInput(itemsSum) : keep;
    }
    totalNote.textContent = manualTotal ? TOTAL_MANUAL_HINT : TOTAL_HINT;
    list.replaceChildren(itemsTable(items, (index) => { items.splice(index, 1); redraw(); }));
    const invoice = { invoiceDate: date.value, netContractPiastres: previewMoney(total) };
    const data = { customer: picker.current(), invoice, items, payments: previewPayments() };
    preview.replaceChildren(items.length ? sheet(data, priceClause, { ...layout, mode: 'full' }) : '');
  }

  const builder = createItemBuilder({
    onAdd: (item) => { items.push(item); redraw(); toast(`تمت إضافة البند (${items.length}) إلى الفاتورة ✓`); },
  });

  const buttons = [];
  /** الحفظ ثم (اختيارياً) الطباعة: تُطبع الفاتورة المحفوظة فعلاً من صفحتها. */
  async function save(thenPrint) {
    errorBox.textContent = '';
    buttons.forEach((b) => { b.disabled = true; });
    try {
      const { head, newCustomer, deposit: depositInfo } = readInvoiceForm({ items, editing, date, total, deposit, depositMethod, picker });
      const record = editId
        ? await updateInvoice(editId, head, items, newCustomer)
        : await saveInvoice(head, items, newCustomer, depositInfo);
      if (newCustomer && !editId) toast(`تمت إضافة العميل «${newCustomer.name}» إلى شاشة العملاء`);
      location.hash = `#/invoice?id=${record.id}${thenPrint ? '&print=1' : ''}`;
    } catch (error) {
      errorBox.textContent = error.message;
      buttons.forEach((b) => { b.disabled = false; });
    }
  }
  const saveButton = (text, thenPrint) =>
    el('button', { className: 'btn', type: 'button', textContent: text, onclick: () => save(thenPrint) });
  buttons.push(
    saveButton(editId ? 'حفظ التعديلات' : 'حفظ الفاتورة', false),
    saveButton(editId ? 'حفظ التعديلات وطباعة' : 'حفظ وطباعة', true));

  total.oninput = () => { manualTotal = total.value.trim() !== ''; redraw(); };
  date.onchange = redraw;
  deposit.oninput = redraw;
  depositMethod.onchange = redraw;

  const payFields = editId ? [] : [lab('العربون المدفوع (جنيه)', deposit), lab('طريقة الدفع', depositMethod)];
  view.append(
    el('div', { className: 'card no-print' }, el('h3', { textContent: 'بيانات الفاتورة' }),
      el('div', { className: 'row' }, ...picker.fields, lab('التاريخ', date)), picker.manualBox),
    builder.card,
    el('div', { className: 'card no-print' }, list,
      el('div', { className: 'row' }, lab('الإجمالي (جنيه)', total), ...payFields), totalNote),
    el('h3', { className: 'no-print', textContent: 'معاينة الفاتورة' }), errorBox,
    el('div', { className: 'actions no-print edit-actions' }, ...buttons), preview);
  redraw();
};
