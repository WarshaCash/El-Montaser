// قراءة كل المخازن للنسخ الاحتياطي، والاستبدال الكامل عند الاستعادة.
import { uid } from '../../core/formatters.js';
import { STORE_NAMES, OUTBOX, isSynced, idOf } from '../db/schema.js';
import { openDB, request, finished } from '../db/connection.js';
import { syncActive, isLocalKey, afterLocalWrite } from '../sync/state.js';
import { writeOutbox } from '../sync/outbox.js';

export async function readAllStores() {
  const db = await openDB();
  const tx = db.transaction(STORE_NAMES);
  const entries = await Promise.all(STORE_NAMES.map(async (name) => [name, await request(tx.objectStore(name).getAll())]));
  return Object.fromEntries(entries);
}

/**
 * استبدال كامل داخل معاملة واحدة؛ أي فشل يُلغيها وتبقى البيانات القديمة.
 * مع المزامنة: السجلات المستعادة تُرفع، والسجلات التي لم تعد موجودة تُحذف من الشيت أيضاً.
 */
export async function replaceAllStores(stores) {
  const db = await openDB();
  const sync = syncActive();
  const tx = db.transaction(sync ? [...STORE_NAMES, OUTBOX] : STORE_NAMES, 'readwrite');
  const completion = finished(tx);
  const batch = uid();
  try {
    for (const name of STORE_NAMES) {
      const store = tx.objectStore(name);
      const track = sync && isSynced(name);
      const oldKeys = track ? await request(store.getAllKeys()) : [];
      store.clear();
      const kept = new Set();
      for (const record of stores[name]) {
        store.put(record);
        const id = idOf(name, record);
        if (track && !isLocalKey(name, id)) { writeOutbox(tx, { store: name, id, op: 'put', record: structuredClone(record) }, batch); kept.add(id); }
      }
      for (const id of oldKeys) if (track && !kept.has(id) && !isLocalKey(name, id)) writeOutbox(tx, { store: name, id, op: 'delete' }, batch);
    }
  } catch (error) {
    try { tx.abort(); } catch { /* المعاملة انتهت بالفعل */ }
    await completion.catch(() => {});
    throw error;
  }
  await completion;
  if (sync) afterLocalWrite();
}
