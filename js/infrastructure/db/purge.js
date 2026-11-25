// المسح بلا أثر: يجمع كل سجل يخص عميلاً و/أو فواتير محددة ويحذفه ضمن المعاملة الجارية، دون كتابة أي سجل بدلاً منه.
// يُستدعى من داخل inTransaction فتلتقط المزامنة كل حذف وتُرسله إلى Google Sheet. المخازن المطلوبة في المعاملة:
// invoices, invoiceItems, payments, cashTransactions, printSnapshots, installments, settlements, auditLogs.

import {request} from './connection.js';

const unique = (rows) => [...new Map(rows.map((row) => [row.id, row])).values()];

/**
 * customerId: يشمل دفعاته وتسوياته (حتى غير المنسوبة لفاتورة). invoiceIds: فواتير تُمسح مع بنودها وأقساطها ولقطاتها.
 * لا يحذف سجل العميل ولا الفواتير نفسها (يتركهما لمن يستدعيه). يعيد أعداد ما مُسح.
 */
async function purgeRecords(tx, { customerId = null, invoiceIds = [] }) {
  const rowsBy = (store, index, key) => request(tx.objectStore(store).index(index).getAll(key));
  const ofInvoices = async (store) => (await Promise.all(invoiceIds.map((id) => rowsBy(store, 'invoiceId', id)))).flat();
  const [items, snapshots, installments, invoicePayments] = await Promise.all(['invoiceItems', 'printSnapshots', 'installments', 'payments'].map(ofInvoices));
  const payments = unique([...invoicePayments, ...(customerId ? await rowsBy('payments', 'customerId', customerId) : [])]);
  const settlements = customerId ? await rowsBy('settlements', 'customerId', customerId) : [];
  const refs = [...invoiceIds, ...payments.map((x) => x.id), ...settlements.map((x) => x.id)];
  const cash = unique((await Promise.all(refs.map((ref) => rowsBy('cashTransactions', 'refId', ref)))).flat());

  const related = new Set([...invoiceIds, ...(customerId ? [customerId] : []),
    ...[items, snapshots, installments, payments, settlements, cash].flatMap((rows) => rows.map((row) => row.id))]);
  const invoiceSet = new Set(invoiceIds);
  const logs = (await request(tx.objectStore('auditLogs').getAll()))
    .filter((log) => related.has(log.refId) || invoiceSet.has(log.details?.invoiceId) || (customerId && log.details?.customerId === customerId));

  const wipe = (store, rows) => rows.forEach((row) => tx.objectStore(store).delete(row.id));
  wipe('cashTransactions', cash); wipe('payments', payments); wipe('settlements', settlements);
  wipe('invoiceItems', items); wipe('printSnapshots', snapshots); wipe('installments', installments); wipe('auditLogs', logs);
  return { items: items.length, payments: payments.length, settlements: settlements.length, cashEntries: cash.length, snapshots: snapshots.length, auditLogs: logs.length };
}

export {purgeRecords};
