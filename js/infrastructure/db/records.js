// بناء السجلات المشتركة: ختم الإنشاء، وسجل التدقيق، وحركة الخزينة، والقيد العكسي.
import { uid, nowISO } from '../../core/formatters.js';
import { request } from './connection.js';

const LOCAL_USER = 'محلي';

/** يضيف المعرّف وتواريخ الإنشاء والتعديل والمستخدم لأي سجل جديد. */
export const stamp = (record) => ({ id: uid(), createdAt: nowISO(), updatedAt: nowISO(), createdBy: LOCAL_USER, ...record });

/** يسجّل حدثاً في سجل التدقيق ضمن المعاملة الجارية. */
export function audit(tx, action, refType, refId, details) {
  tx.objectStore('auditLogs').put({ id: uid(), at: nowISO(), user: LOCAL_USER, action, refType, refId, details });
}

/** يكتب دفعة وحركة خزينة «قبض» مقابلة لها (ضمن معاملة جارية تشمل المخزنين). */
export function insertPayment(tx, payment) {
  tx.objectStore('payments').add(payment);
  tx.objectStore('cashTransactions').add(stamp({
    type: 'receipt', sign: 1, label: 'دفعة عميل', refType: 'payment', refId: payment.id,
    treasuryId: payment.treasuryId, amountPiastres: payment.amountPiastres, date: payment.paidAt,
  }));
}

/** عميل جديد يُنشأ أثناء حفظ/تعديل فاتورة: يتحقق من بياناته أولاً. يعيد null إن لم يُطلب عميل جديد. */
export function cleanNewCustomer(input, normalizePhone) {
  if (!input) return null;
  const customer = { name: String(input.name || '').trim(), phone: input.phone ? normalizePhone(input.phone) : '' };
  if (customer.name.length < 2) throw new Error('اسم العميل مطلوب');
  return customer;
}

export function insertCustomerViaInvoice(tx, fields) {
  const customer = stamp({ openingBalancePiastres: 0, ...fields });
  tx.objectStore('customers').add(customer);
  audit(tx, 'إضافة عميل', 'customer', customer.id, { name: customer.name, viaInvoice: true });
  return customer;
}

/** إشارة القيد العكسي لحركة: عكس إشارة حركتها الأصلية في الخزينة. */
export async function reversalSign(tx, refType, refId) {
  const entries = await request(tx.objectStore('cashTransactions').index('refId').getAll(refId));
  const original = entries.find((entry) => entry.type !== 'reversal');
  if (!original) return refType === 'expense' ? -1 : 1;
  return -(original.sign ?? (original.type === 'expense' ? -1 : 1));
}

export const reversalEntry = (fields) => stamp({ type: 'reversal', ...fields });
