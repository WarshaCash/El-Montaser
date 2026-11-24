import { get, getByIndex } from '../../../infrastructure/db/store.js';

/** سطر محفوظ ← بند بصيغة الشاشة (الحقول الاختيارية القديمة تأخذ قيماً افتراضية). */
const toEditorItem = (row) => ({
  category: row.category, specs: row.specs, description: row.description, lines: row.lines || null,
  sizeText: row.sizeText || '',
  qty: row.qty, unitPricePiastres: row.unitPricePiastres, notes: row.notes || '',
});

/** بيانات فاتورة قائمة لتعديلها: الرأس، والدفعات مرتبة بالتاريخ، والبنود مرتبة برقم السطر. */
export async function loadInvoiceForEdit(id) {
  const invoice = await get('invoices', id);
  if (!invoice) throw new Error('الفاتورة غير موجودة');
  const [rows, payments] = await Promise.all([getByIndex('invoiceItems', 'invoiceId', id), getByIndex('payments', 'invoiceId', id)]);
  return {
    invoice,
    payments: payments.sort((a, b) => a.paidAt.localeCompare(b.paidAt)),
    items: rows.sort((a, b) => a.lineNo - b.lineNo).map(toEditorItem),
  };
}
