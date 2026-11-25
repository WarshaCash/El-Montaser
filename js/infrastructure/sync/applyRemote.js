// تطبيق ما جاء من الشيت على قاعدة الجهاز، ورفع بيانات الجهاز عند أول ربط. لا يمر عبر الالتقاط (فلا يعود صدىً للشيت).

import {uid} from '../../core/formatters.js';
import {openDB, request, finished} from '../db/connection.js';
import {OUTBOX, SYNCED_STORES, KEYED, idOf} from '../db/schema.js';
import {isLocalKey} from './state.js';
import {writeOutbox} from './outbox.js';

const DATA_EVENT = 'workshop:data-changed';
const announce = () => globalThis.dispatchEvent?.(new CustomEvent(DATA_EVENT));
const keyOf = (store, id) => `${store}\u0000${id}`;

/** يطبّق تغييرات قادمة من أجهزة أخرى. ما عليه تغيير محلي لم يُرسل بعد يبقى (تغيير هذا الجهاز هو الأحدث). */
async function applyChanges(changes) {
  const known = changes.filter((c) => SYNCED_STORES.includes(c.store));
  if (!known.length) return 0;
  const db = await openDB();
  const tx = db.transaction([...new Set([...known.map((c) => c.store), OUTBOX])], 'readwrite');
  const done = finished(tx);
  const pending = new Set((await request(tx.objectStore(OUTBOX).getAll())).map((e) => keyOf(e.store, e.id)));
  let applied = 0;
  for (const change of known) {
    if (pending.has(keyOf(change.store, change.id))) continue;
    const store = tx.objectStore(change.store);
    if (change.op === 'delete') store.delete(change.id); else store.put(change.record);
    applied++;
  }
  await done;
  if (applied) announce();
  return applied;
}

const newer = (a, b) => String(a.updatedAt || '') > String(b.updatedAt || '');

/**
 * دمج أول ربط بين بيانات الجهاز ولقطة الشيت دون فقدان أي شيء:
 * ما في الشيت وحده ينزل للجهاز، وما في الجهاز وحده يُرفع، وما في الاثنين يفوز فيه الأحدث (updatedAt).
 * سجلات الجهاز المحذوفة من الشيت لا تعود (الخادم يتجاهل التعديل على سجل محذوف).
 */
async function mergeSnapshot(snapshot) {
  const db = await openDB();
  const tx = db.transaction([...SYNCED_STORES, OUTBOX], 'readwrite');
  const done = finished(tx);
  const batch = uid();
  for (const name of SYNCED_STORES) {
    const store = tx.objectStore(name);
    const local = new Map((await request(store.getAll())).map((r) => [idOf(name, r), r]));
    const remote = new Map((snapshot.stores?.[name] || []).map((r) => [idOf(name, r), r]));
    for (const [id, record] of remote) {
      if (isLocalKey(name, id)) continue;
      const mine = local.get(id);
      if (mine && newer(mine, record)) writeOutbox(tx, { store: name, id, op: 'put', record: mine }, batch);
      else store.put(record);
    }
    for (const [id, record] of local) {
      if (!remote.has(id) && !isLocalKey(name, id)) writeOutbox(tx, { store: name, id, op: 'put', record }, batch);
    }
  }
  await done;
  announce();
}

/** عدد سجلات العمل في الجهاز (بدون الإعدادات): يحدد هل عند الجهاز بيانات تستحق الرفع أو الحماية. */
async function countLocalRecords() {
  const db = await openDB();
  const names = SYNCED_STORES.filter((name) => !KEYED.includes(name));
  const tx = db.transaction(names);
  const counts = await Promise.all(names.map((name) => request(tx.objectStore(name).count())));
  return counts.reduce((sum, n) => sum + n, 0);
}

/** يضع كل سجلات الجهاز في صندوق الصادر ليُرفع إلى شيت فارغ (أول ربط لجهاز عليه بيانات). */
async function uploadAllLocal() {
  const db = await openDB();
  const tx = db.transaction([...SYNCED_STORES, OUTBOX], 'readwrite');
  const done = finished(tx);
  const batch = uid();
  for (const name of SYNCED_STORES) {
    for (const record of await request(tx.objectStore(name).getAll())) {
      const id = idOf(name, record);
      if (!isLocalKey(name, id)) writeOutbox(tx, { store: name, id, op: 'put', record }, batch);
    }
  }
  await done;
}

export {DATA_EVENT, applyChanges, mergeSnapshot, countLocalRecords, uploadAllLocal};
