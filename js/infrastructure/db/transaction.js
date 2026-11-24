import { uid } from '../../core/formatters.js';
import { openDB, finished } from './connection.js';
import { OUTBOX } from './schema.js';
import { syncActive, afterLocalWrite } from '../sync/state.js';
import { captureTransaction } from '../sync/capture.js';

/**
 * ينفّذ عملاً داخل معاملة كتابة واحدة: إن نجح اكتملت المعاملة كلها، وإن فشل أي شيء أُلغيت كلها
 * ولا يبقى منها أثر (هذه هي الذرّية التي تعتمد عليها الحسابات والخزينة).
 * مع تفعيل المزامنة تُسجَّل كل كتابة أيضاً في صندوق الصادر داخل المعاملة نفسها.
 * work(tx) تعيد نتيجة العملية.
 */
export async function inTransaction(storeNames, work) {
  const db = await openDB();
  const sync = syncActive();
  const tx = db.transaction(sync ? [...new Set([...storeNames, OUTBOX])] : storeNames, 'readwrite');
  const completion = finished(tx);
  try {
    const result = await work(sync ? captureTransaction(tx, uid()) : tx);
    await completion;
    if (sync) afterLocalWrite();
    return result;
  } catch (error) {
    try { tx.abort(); } catch { /* المعاملة انتهت بالفعل */ }
    await completion.catch(() => {});
    throw error;
  }
}
