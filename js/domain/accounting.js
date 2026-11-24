// المصدر الوحيد لكل المعادلات المالية. كل المبالغ بالقروش (أعداد صحيحة).
const sum = a => a.reduce((s, x) => s + x, 0);
export const lineTotal = i => i.qty * i.unitPricePiastres;

export function invoiceTotals(items, payments, inv) {
  const net = Number.isInteger(inv?.netContractPiastres) ? inv.netContractPiastres : sum(items.map(lineTotal));
  const paid = sum(payments.filter(p => p.status === 'active').map(p => p.amountPiastres));
  return { net, paid, remaining: Math.max(net - paid, 0), credit: Math.max(paid - net, 0) };
}

export function validatePayment(p) {
  const e = [];
  if (!Number.isInteger(p.amountPiastres) || p.amountPiastres <= 0) e.push('مبلغ الدفعة يجب أن يكون أكبر من صفر');
  if (!p.paidAt || isNaN(Date.parse(p.paidAt))) e.push('تاريخ الدفعة غير صالح');
  if (!p.method) e.push('طريقة الدفع مطلوبة');
  if (!p.customerId) e.push('العميل مطلوب');
  if (!p.opId) e.push('معرّف العملية مطلوب');
  return e;
}

/** يوم الحركة YYYY-MM-DD فقط: بعض التواريخ تحمل وقتاً كاملاً (مثل createdAt) وبعضها يوماً فقط، ولا يصح ترتيبهما معاً كنصوص مختلفة الطول. */
const dayOf = d => String(d ?? '').slice(0, 10);
/** أولوية الحركات في اليوم الواحد: الرصيد الافتتاحي ثم الفاتورة ثم الدفعة. */
const RANK = { opening: 0, invoice: 1, payment: 2 };

/** كشف حساب زمني: مدين/دائن/رصيد بعد كل حركة (الرصيد الموجب = مستحق على العميل). */
export function customerStatement(customer, invoices, itemsByInvoice, payments) {
  const rows = [];
  const ob = customer.openingBalancePiastres || 0;
  if (ob) rows.push({ rank: RANK.opening, date: dayOf(customer.openingBalanceDate || customer.createdAt), type: 'رصيد افتتاحي', debit: Math.max(ob, 0), credit: Math.max(-ob, 0) });
  for (const inv of invoices.filter(i => i.status === 'active'))
    rows.push({ rank: RANK.invoice, date: dayOf(inv.invoiceDate), type: 'فاتورة', ref: inv.id, debit: Number.isInteger(inv.netContractPiastres) ? inv.netContractPiastres : sum((itemsByInvoice[inv.id] || []).map(lineTotal)), credit: 0 });
  for (const p of payments.filter(p => p.status === 'active'))
    rows.push({ rank: RANK.payment, date: dayOf(p.paidAt), type: 'دفعة', ref: p.receiptNo || p.id, debit: 0, credit: p.amountPiastres });
  // التاريخ ثم الأولوية؛ ترتيب Array.sort ثابت فتبقى الحركات المتماثلة بترتيب إدخالها
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.rank - b.rank));
  let bal = 0;
  return rows.map(({ rank, ...r }) => ({ ...r, balance: (bal += r.debit - r.credit) }));
}

export const cashSign = t => t.sign ?? (t.type === 'expense' ? -1 : 1);
export const treasuryBalance = (opening, txs) => opening + sum(txs.map(t => cashSign(t) * t.amountPiastres));
export function customerBalance(customer, invoices, itemsByInvoice, payments) {
  const s = customerStatement(customer, invoices, itemsByInvoice, payments); return s.length ? s[s.length - 1].balance : 0;
}
