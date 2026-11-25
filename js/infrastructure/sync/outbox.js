// صندوق الصادر: كل كتابة محلية تُسجَّل هنا داخل نفس معاملة IndexedDB، فإما يُحفظ التغيير والسجل معاً أو لا شيء.

import {nowISO} from '../../core/formatters.js';
import {OUTBOX} from '../db/schema.js';
import {request, openDB} from '../db/connection.js';

/** change = { store, id, op: 'put' | 'delete', record? } */
function writeOutbox(tx, change, batch) {
  tx.objectStore(OUTBOX).add({ batch, at: nowISO(), ...change });
}

async function readOutbox() {
  const db = await openDB();
  return request(db.transaction(OUTBOX).objectStore(OUTBOX).getAll());
}

async function countOutbox() {
  const db = await openDB();
  return request(db.transaction(OUTBOX).objectStore(OUTBOX).count());
}

async function deleteOutbox(seqs) {
  const db = await openDB();
  const tx = db.transaction(OUTBOX, 'readwrite');
  const store = tx.objectStore(OUTBOX);
  seqs.forEach((seq) => store.delete(seq));
  await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
}

/** يدمج التغييرات المتتالية لنفس السجل في تغيير واحد (آخرها)، مع أرقام الإدخالات التي يمثلها. */
function coalesce(entries) {
  const byKey = new Map();
  for (const entry of entries) {
    const key = `${entry.store}\u0000${entry.id}`;
    const slot = byKey.get(key) || { seqs: [] };
    slot.seqs.push(entry.seq);
    slot.change = { store: entry.store, id: entry.id, op: entry.op, record: entry.record };
    byKey.set(key, slot);
  }
  return [...byKey.values()];
}

export {writeOutbox, readOutbox, countOutbox, deleteOutbox, coalesce};
