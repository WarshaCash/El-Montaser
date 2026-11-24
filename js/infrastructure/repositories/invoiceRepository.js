// الفواتير وبنودها ولقطات طباعتها. كل عملية معاملة واحدة تشمل ما يتبعها (العميل، العربون، التدقيق).
import { uid, nowISO } from '../../core/formatters.js';
import { normalizePhone } from '../../core/validators.js';
import { request } from '../db/connection.js';
import { inTransaction } from '../db/transaction.js';
import { stamp, audit, insertPayment, cleanNewCustomer, insertCustomerViaInvoice, reversalSign, reversalEntry } from '../db/records.js';

const lineTotal = (item) => item.qty * item.unitPricePiastres;
const sumOf = (items) => items.reduce((sum, item) => sum + lineTotal(item), 0);

function insertItems(tx, invoiceId, items) {
  items.forEach((item, index) => {
    tx.objectStore('invoiceItems').add(stamp({ ...item, invoiceId, lineNo: index + 1, totalPiastres: lineTotal(item) }));
  });
}

/** عربون يُسجَّل مع الفاتورة نفسها: دفعة + حركة خزينة + تدقيق. */
function insertDeposit(tx, invoice, deposit) {
  const payment = stamp({
    opId: uid(), invoiceId: invoice.id, customerId: invoice.customerId, amountPiastres: deposit.amountPiastres,
    paidAt: invoice.invoiceDate, method: deposit.method || 'نقدي', treasuryId: 'main', receiptNo: null,
    notes: 'عربون عند إنشاء الفاتورة', status: 'active',
  });
  insertPayment(tx, payment);
  audit(tx, 'تسجيل دفعة', 'payment', payment.id, { amount: payment.amountPiastres, deposit: true });
}

export async function saveInvoice(invoice, items, newCustomer = null, deposit = null) {
  const customerInput = cleanNewCustomer(newCustomer, normalizePhone);
  const stores = ['invoices', 'invoiceItems', 'auditLogs', 'customers', 'payments', 'cashTransactions'];
  return inTransaction(stores, (tx) => {
    const head = customerInput ? { ...invoice, customerId: insertCustomerViaInvoice(tx, customerInput).id } : invoice;
    const record = stamp({ status: 'active', ...head });
    record.netContractPiastres = Number.isInteger(head.netContractPiastres) ? head.netContractPiastres : sumOf(items);
    tx.objectStore('invoices').add(record);
    insertItems(tx, record.id, items);
    if (deposit && deposit.amountPiastres > 0) insertDeposit(tx, record, deposit);
    audit(tx, 'إنشاء فاتورة', 'invoice', record.id, { items: items.length });
    return record;
  });
}

/** تعديل فاتورة قائمة: تُستبدل بنودها وإجماليها وتاريخها، وتُحفظ نسخة ما قبل التعديل كاملة في التدقيق. الدفعات لا تُمس. */
export async function updateInvoice(id, head, items, newCustomer = null) {
  const customerInput = cleanNewCustomer(newCustomer, normalizePhone);
  if (!Number.isInteger(head.netContractPiastres) || head.netContractPiastres <= 0) throw new Error('الإجمالي يجب أن يكون أكبر من صفر');
  const stores = ['invoices', 'invoiceItems', 'auditLogs', 'customers', 'payments'];
  return inTransaction(stores, async (tx) => {
    const old = await request(tx.objectStore('invoices').get(id));
    if (!old) throw new Error('الفاتورة غير موجودة');
    const oldItems = await request(tx.objectStore('invoiceItems').index('invoiceId').getAll(id));
    const customerId = customerInput ? insertCustomerViaInvoice(tx, customerInput).id : head.customerId;
    const hasPayments = await request(tx.objectStore('payments').index('invoiceId').count(id));
    if (customerId !== old.customerId && hasPayments) throw new Error('لا يمكن تغيير العميل بعد تسجيل دفعات على الفاتورة');
    const { invoiceDate, netContractPiastres } = head;
    const updated = { ...old, customerId, invoiceDate, netContractPiastres, updatedAt: nowISO() };
    tx.objectStore('invoices').put(updated);
    oldItems.forEach((item) => tx.objectStore('invoiceItems').delete(item.id));
    insertItems(tx, id, items);
    const after = { invoiceDate: head.invoiceDate, netContractPiastres: head.netContractPiastres, items: items.length };
    audit(tx, 'تعديل فاتورة', 'invoice', id, { before: { invoice: old, items: oldItems }, after });
    return updated;
  });
}

/** يفصل دفعة عن الفاتورة المحذوفة: إما بقيد عكسي (ردّ المبلغ) أو تبقى رصيداً دائناً على العميل. */
async function releasePayment(tx, payment, mode, invoice, why) {
  if (payment.status === 'active' && mode === 'refund') {
    const sign = await reversalSign(tx, 'payment', payment.id);
    tx.objectStore('payments').put({
      ...payment, invoiceId: null, status: 'reversed', reversedAt: nowISO(),
      reverseReason: 'حذف الفاتورة: ' + why, updatedAt: nowISO(),
    });
    tx.objectStore('cashTransactions').add(reversalEntry({
      sign, label: 'قيد عكسي (حذف فاتورة): ' + why, refType: 'payment', refId: payment.id,
      treasuryId: payment.treasuryId || 'main', amountPiastres: payment.amountPiastres, date: nowISO().slice(0, 10),
    }));
    return;
  }
  const note = `كانت على فاتورة ${invoice.invoiceDate} (محذوفة)`;
  const notes = payment.notes ? payment.notes + ' — ' + note : note;
  tx.objectStore('payments').put({ ...payment, invoiceId: null, notes, updatedAt: nowISO() });
}

/**
 * حذف فاتورة نهائياً مع بنودها ولقطات طباعتها في معاملة واحدة، وتبقى نسختها كاملة في سجل التدقيق.
 * mode='refund': الدفعات الفعّالة تُلغى بقيد عكسي (ردّ المبلغ) | mode='credit': تبقى وتتحول لرصيد دائن (الخزينة لا تتغير).
 * في الحالتين تُفصل كل دفعات الفاتورة عنها (invoiceId=null) حتى لا تشير لفاتورة غير موجودة.
 */
export async function deleteInvoice(id, reason, mode = 'credit') {
  const why = String(reason || '').trim();
  if (!why) throw new Error('سبب الحذف مطلوب');
  if (!['refund', 'credit'].includes(mode)) throw new Error('اختيار غير صالح للدفعات');
  const stores = ['invoices', 'invoiceItems', 'payments', 'cashTransactions', 'printSnapshots', 'auditLogs'];
  return inTransaction(stores, async (tx) => {
    const invoice = await request(tx.objectStore('invoices').get(id));
    if (!invoice) throw new Error('الفاتورة غير موجودة');
    const ofInvoice = (store) => request(tx.objectStore(store).index('invoiceId').getAll(id));
    const [items, payments, snapshots] = await Promise.all(['invoiceItems', 'payments', 'printSnapshots'].map(ofInvoice));
    for (const payment of payments) await releasePayment(tx, payment, mode, invoice, why);
    items.forEach((item) => tx.objectStore('invoiceItems').delete(item.id));
    snapshots.forEach((snapshot) => tx.objectStore('printSnapshots').delete(snapshot.id));
    tx.objectStore('invoices').delete(id);
    audit(tx, 'حذف فاتورة نهائياً', 'invoice', id, {
      reason: why, paymentsMode: payments.some((p) => p.status === 'active') ? mode : null,
      invoice, items, payments, printedCopies: snapshots.length,
    });
  });
}

/** لقطة طباعة لنسخة من الفاتورة (للمراجعة لاحقاً) مع تدقيق. */
export async function addSnapshot(snapshot) {
  return inTransaction(['printSnapshots', 'auditLogs'], (tx) => {
    const record = stamp(snapshot);
    tx.objectStore('printSnapshots').add(record);
    audit(tx, 'طباعة نسخة فاتورة', 'invoice', snapshot.invoiceId, { version: snapshot.version });
    return record;
  });
}
