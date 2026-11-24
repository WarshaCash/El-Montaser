// الدفعات والمصروفات والإيرادات وقيود الإلغاء: كل عملية ذرّية مع حركة الخزينة والتدقيق.
import { nowISO } from '../../core/formatters.js';
import { request } from '../db/connection.js';
import { inTransaction } from '../db/transaction.js';
import { stamp, audit, insertPayment, reversalSign, reversalEntry } from '../db/records.js';
import { validateExpense, workshopName, expenseTitle } from '../../domain/expenses.js';

/** دفعة ذرية: الدفعة + حركة الخزينة + التدقيق في معاملة واحدة؛ opId فريد يمنع التكرار. */
export async function addPayment(input) {
  try {
    const payment = await inTransaction(['payments', 'cashTransactions', 'auditLogs'], (tx) => {
      const record = stamp({ status: 'active', ...input });
      insertPayment(tx, record);
      audit(tx, 'تسجيل دفعة', 'payment', record.id, { amount: record.amountPiastres });
      return record;
    });
    return { ok: true, payment };
  } catch (error) {
    if (error?.name === 'ConstraintError') return { ok: false, duplicate: true };
    throw error;
  }
}

const MONEY_KINDS = {
  expense: { store: 'expenses', sign: -1, auditAction: 'تسجيل مصروف' },
  income: { store: 'otherIncome', sign: 1, auditAction: 'تسجيل إيراد' },
};

/** مصروف أو إيراد آخر: السجل + حركة الخزينة + التدقيق في معاملة واحدة. المصروف يُشترط له تحديد الورشة. */
export async function addMoney(kind, input) {
  const { store, sign, auditAction } = MONEY_KINDS[kind === 'expense' ? 'expense' : 'income'];
  const clean = kind === 'expense' ? validateExpense(input) : null;
  const label = clean ? `${expenseTitle(clean)} — ${workshopName(clean.workshop)}` : input.category || '';
  return inTransaction([store, 'cashTransactions', 'auditLogs'], (tx) => {
    const record = stamp({ status: 'active', ...(clean || input) });
    tx.objectStore(store).add(record);
    tx.objectStore('cashTransactions').add(stamp({
      type: kind, sign, label, refType: kind, refId: record.id,
      treasuryId: 'main', amountPiastres: record.amountPiastres, date: record.date,
    }));
    audit(tx, auditAction, kind, record.id, { amount: record.amountPiastres, ...(clean && { workshop: clean.workshop }) });
    return record;
  });
}

const STORE_OF = { payment: 'payments', expense: 'expenses', income: 'otherIncome' };

/** إلغاء حركة مرحّلة بقيد عكسي مع سبب وتاريخ؛ لا حذف ولا تعديل للأصل سوى حالته. */
export async function reverseRecord(refType, id, reason) {
  const why = String(reason || '').trim();
  if (!why) throw new Error('سبب الإلغاء مطلوب');
  const store = STORE_OF[refType];
  return inTransaction([store, 'cashTransactions', 'auditLogs'], async (tx) => {
    const record = await request(tx.objectStore(store).get(id));
    if (!record || record.status !== 'active') throw new Error('الحركة غير فعّالة أو غير موجودة');
    const sign = await reversalSign(tx, refType, id);
    tx.objectStore(store).put({ ...record, status: 'reversed', reversedAt: nowISO(), reverseReason: why, updatedAt: nowISO() });
    tx.objectStore('cashTransactions').add(reversalEntry({
      sign, label: 'قيد عكسي: ' + why, refType, refId: id, treasuryId: 'main',
      amountPiastres: record.amountPiastres, date: nowISO().slice(0, 10),
    }));
    audit(tx, 'إلغاء بقيد عكسي', refType, id, { reason: why });
  });
}

