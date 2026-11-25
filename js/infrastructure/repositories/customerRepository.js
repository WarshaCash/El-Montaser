import {nowISO} from '../../core/formatters.js';
import {normalizePhone, phoneForUpdate} from '../../core/validators.js';
import {request} from '../db/connection.js';
import {inTransaction} from '../db/transaction.js';
import {stamp, audit} from '../db/records.js';
import {purgeRecords} from '../db/purge.js';

const requireName = (value) => {
  const name = String(value || '').trim();
  if (name.length < 2) throw new Error('اسم العميل مطلوب');
  return name;
};

async function addCustomer(input) {
  const fields = { ...input, phone: normalizePhone(input.phone) };
  return inTransaction(['customers', 'auditLogs'], (tx) => {
    const customer = stamp({ openingBalancePiastres: 0, ...fields });
    tx.objectStore('customers').add(customer);
    audit(tx, 'إضافة عميل', 'customer', customer.id, { name: customer.name });
    return customer;
  });
}

async function updateCustomer(id, input) {
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

/**
 * حذف عميل نهائياً بلا أثر مع كل ما يخصه: فواتيره وبنودها وأقساطها ولقطات طباعتها، ودفعاته (حتى غير المنسوبة لفاتورة)
 * وتسوياته وكل حركات الخزينة الخاصة بها وسجل تدقيقه، في معاملة واحدة. لا يُكتب أي سجل بدلاً منه، ويصل الحذف إلى Google Sheet.
 */
async function deleteCustomer(id) {
  const stores = ['customers', 'invoices', 'invoiceItems', 'payments', 'cashTransactions', 'printSnapshots', 'installments', 'settlements', 'auditLogs'];
  return inTransaction(stores, async (tx) => {
    if (!await request(tx.objectStore('customers').get(id))) throw new Error('العميل غير موجود');
    const invoices = await request(tx.objectStore('invoices').index('customerId').getAll(id));
    const counts = await purgeRecords(tx, { customerId: id, invoiceIds: invoices.map((invoice) => invoice.id) });
    invoices.forEach((invoice) => tx.objectStore('invoices').delete(invoice.id));
    tx.objectStore('customers').delete(id);
    return { invoices: invoices.length, ...counts };
  });
}

export {addCustomer, updateCustomer, deleteCustomer};
