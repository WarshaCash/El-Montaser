import { nowISO } from '../../core/formatters.js';
import { normalizePhone, phoneForUpdate } from '../../core/validators.js';
import { request } from '../db/connection.js';
import { inTransaction } from '../db/transaction.js';
import { stamp, audit } from '../db/records.js';

const requireName = (value) => {
  const name = String(value || '').trim();
  if (name.length < 2) throw new Error('اسم العميل مطلوب');
  return name;
};

export async function addCustomer(input) {
  const fields = { ...input, phone: normalizePhone(input.phone) };
  return inTransaction(['customers', 'auditLogs'], (tx) => {
    const customer = stamp({ openingBalancePiastres: 0, ...fields });
    tx.objectStore('customers').add(customer);
    audit(tx, 'إضافة عميل', 'customer', customer.id, { name: customer.name });
    return customer;
  });
}

export async function updateCustomer(id, input) {
  const name = requireName(input.name);
  return inTransaction(['customers', 'auditLogs'], async (tx) => {
    const before = await request(tx.objectStore('customers').get(id));
    if (!before) throw new Error('العميل غير موجود');
    const phone = phoneForUpdate(input.phone, before.phone); // عميل قديم بلا هاتف يُعدَّل اسمه دون إجباره على إدخال هاتف
    const after = { ...before, name, phone, updatedAt: nowISO() };
    tx.objectStore('customers').put(after);
    audit(tx, 'تعديل بيانات عميل', 'customer', id, { before: { name: before.name, phone: before.phone }, after: { name, phone } });
    return after;
  });
}

const blockedMessage = (name, invoices, payments, settlements) =>
  `لا يمكن حذف «${name}» لأن له ${invoices} فاتورة و${payments} دفعة${settlements ? ` و${settlements} تسوية` : ''} مسجلة. `
  + 'الحذف النهائي متاح فقط للعميل الذي ليست له أي حركة مالية، حفاظاً على سلامة الحسابات والخزينة.';

/** حذف نهائي لعميل بلا أي حركة مالية؛ صاحب الفواتير/الدفعات لا يُحذف حفاظاً على سلامة الحسابات. */
export async function deleteCustomer(id) {
  const stores = ['customers', 'invoices', 'payments', 'settlements', 'auditLogs'];
  return inTransaction(stores, async (tx) => {
    const customer = await request(tx.objectStore('customers').get(id));
    if (!customer) throw new Error('العميل غير موجود');
    const countOf = (store) => request(tx.objectStore(store).index('customerId').count(id));
    const [invoices, payments, settlements] = [await countOf('invoices'), await countOf('payments'), await countOf('settlements')];
    if (invoices || payments || settlements) throw new Error(blockedMessage(customer.name, invoices, payments, settlements));
    tx.objectStore('customers').delete(id);
    audit(tx, 'حذف عميل نهائياً', 'customer', id, { name: customer.name, phone: customer.phone });
  });
}
