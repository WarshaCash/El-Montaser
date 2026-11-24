import { el } from '../../core/dom.js';
import { getAll, get, getKV, setKV } from '../../infrastructure/db/store.js';
import { addPayment, addMoney, reverseRecord } from '../../infrastructure/repositories/ledgerRepository.js';
import { invoiceTotals, customerStatement, customerBalance, treasuryBalance, cashSign, validatePayment } from '../../domain/accounting.js';
import { parsePiastres, formatEGP, uid } from '../../core/formatters.js';
import { navigate } from '../../shell/router.js';
import { workshopName, expenseTitle } from '../../domain/expenses.js';

const today = () => new Date().toISOString().slice(0, 10);
const lab = (t, i) => el('label', { className: 'f' }, t + ' ', i);
const tbl = (heads, rows, empty = 'لا توجد بيانات.') => rows.length ? el('table', {}, el('thead', {}, el('tr', {}, ...heads.map(h => el('th', { textContent: h })))),
  el('tbody', {}, ...rows.map(r => el('tr', {}, ...r.map(c => c instanceof Node ? el('td', {}, c) : el('td', { textContent: String(c) })))))) : el('div', { className: 'empty', textContent: empty });
const kpi = (t, n) => el('div', { className: 'card kpi' }, el('span', { textContent: t }), el('b', { textContent: n }));
async function load() {
  const [c, i, it, p] = await Promise.all([getAll('customers'), getAll('invoices'), getAll('invoiceItems'), getAll('payments')]);
  const by = {}; it.forEach(x => (by[x.invoiceId] ??= []).push(x)); return { c, i, it, p, by };
}
const forCustomer = (d, c) => ({ inv: d.i.filter(x => x.customerId === c.id), pay: d.p.filter(x => x.customerId === c.id) });

export async function renderAccounts(v) {
  const d = await load(); let contracts = 0, paid = 0, due = 0, credit = 0; const rows = [];
  for (const c of d.c) {
    const { inv, pay } = forCustomer(d, c), act = inv.filter(i => i.status === 'active');
    const net = act.reduce((s, i) => s + invoiceTotals(d.by[i.id] || [], [], i).net, 0), pd = pay.filter(p => p.status === 'active').reduce((s, p) => s + p.amountPiastres, 0), bal = customerBalance(c, inv, d.by, pay);
    contracts += net; paid += pd; if (bal > 0) due += bal; else credit -= bal;
    rows.push([el('a', { href: `#/customer?id=${c.id}`, textContent: c.name }), formatEGP(net), formatEGP(pd), bal >= 0 ? formatEGP(bal) : `رصيد دائن ${formatEGP(-bal)}`, el('span', {}, el('a', { href: `#/statement?id=${c.id}`, textContent: 'كشف الحساب' }), ' • ', el('a', { href: `#/collect?customer=${c.id}`, textContent: 'تحصيل دفعة' }))]);
  }
  v.append(el('div', { className: 'grid' }, kpi('قيمة التعاقدات', formatEGP(contracts)), kpi('إجمالي التحصيل', formatEGP(paid)), kpi('المستحق على العملاء', formatEGP(due)), kpi('أرصدة دائنة للعملاء', formatEGP(credit))),
    el('div', { className: 'card' }, tbl(['العميل', 'التعاقدات', 'المدفوع', 'الرصيد', ''], rows, 'لا يوجد عملاء بعد.')));
}

export async function renderStatement(v, params) {
  const c = await get('customers', params.get('id')); if (!c) throw new Error('العميل غير موجود');
  const d = await load(), { inv, pay } = forCustomer(d, c), st = customerStatement(c, inv, d.by, pay);
  v.append(el('div', { className: 'card' }, el('h3', { textContent: `كشف حساب: ${c.name}` }), tbl(['التاريخ', 'الحركة', 'المرجع', 'مدين', 'دائن', 'الرصيد بعد الحركة'], st.map(r => [r.date.slice(0, 10), r.type, r.ref ? String(r.ref).slice(0, 8) : '—', r.debit ? formatEGP(r.debit) : '—', r.credit ? formatEGP(r.credit) : '—', formatEGP(r.balance)]), 'لا توجد حركات.'),
    el('button', { className: 'btn no-print', textContent: 'طباعة', onclick: () => print() })));
}

export async function renderTreasury(v) {
  const [txs, opening] = await Promise.all([getAll('cashTransactions'), getKV('settings', 'treasuryOpening', 0)]);
  const reversed = new Set(txs.filter(t => t.type === 'reversal').map(t => t.refId)), err = el('div', { className: 'err' });
  const guard = f => async () => { err.textContent = ''; try { await f(); navigate(); } catch (e) { err.textContent = e.message; } };
  const form = (kind, title) => {
    const date = el('input', { type: 'date', value: today() }), cat = el('input', { placeholder: 'مصدر الإيراد' }), amt = el('input', { placeholder: 'المبلغ بالجنيه' }), nt = el('input', { placeholder: 'ملاحظات' });
    return el('div', { className: 'card no-print' }, el('h3', { textContent: title }), el('div', { className: 'row' }, lab('التاريخ', date), cat, amt, nt, el('button', { className: 'btn', textContent: 'تسجيل', onclick: guard(async () => {
      if (!cat.value.trim()) throw new Error('البند مطلوب'); const a = parsePiastres(amt.value); if (a <= 0) throw new Error('المبلغ يجب أن يكون أكبر من صفر'); if (!date.value) throw new Error('التاريخ مطلوب');
      await addMoney(kind, { date: date.value, category: cat.value.trim(), amountPiastres: a, notes: nt.value.trim(), treasuryId: 'main' }); }) })));
  };
  const op = el('input', { value: (opening / 100).toFixed(2) });
  const label = { receipt: 'مقبوضات', expense: 'مصروف', income: 'إيراد', reversal: 'قيد عكسي' };
  txs.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const rows = txs.map(t => [t.date, label[t.type] || t.type, t.label || '', (cashSign(t) < 0 ? '−' : '+') + formatEGP(t.amountPiastres),
    t.type !== 'reversal' && !reversed.has(t.refId) ? el('button', { className: 'btn danger no-print', textContent: 'إلغاء بقيد عكسي', onclick: guard(async () => { const r = prompt('سبب الإلغاء (مطلوب):'); if (r === null) throw new Error(''); await reverseRecord(t.refType, t.refId, r); }) }) : (t.type === 'reversal' ? '' : 'ملغاة')]);
  v.append(el('div', { className: 'grid' }, kpi('رصيد الخزينة الرئيسية', formatEGP(treasuryBalance(opening, txs)))),
    el('div', { className: 'card no-print' }, el('div', { className: 'row' }, lab('الرصيد الافتتاحي (جنيه)', op), el('button', { className: 'btn', textContent: 'حفظ', onclick: guard(async () => setKV('settings', 'treasuryOpening', parsePiastres(op.value))) }))),
    form('income', 'تسجيل إيراد آخر'), err, el('div', { className: 'card' }, el('h3', { textContent: 'حركة الخزينة' }), tbl(['التاريخ', 'النوع', 'البيان', 'المبلغ', ''], rows, 'لا توجد حركات.')));
}
