// قراءات عامة بسيطة على أي مخزن، وقيم الإعدادات «مفتاح ← قيمة».

import {nowISO} from '../../core/formatters.js';
import {uid} from '../../core/formatters.js';
import {openDB, request, finished} from './connection.js';
import {OUTBOX, isSynced} from './schema.js';
import {syncActive, isLocalKey, afterLocalWrite} from '../sync/state.js';
import {writeOutbox} from '../sync/outbox.js';

const readStore = async (name) => (await openDB()).transaction(name).objectStore(name);

const getAll = async (store) => request((await readStore(store)).getAll());
const count = async (store) => request((await readStore(store)).count());
const get = async (store, id) => request((await readStore(store)).get(id));
const getByIndex = async (store, index, key) => request((await readStore(store)).index(index).getAll(key));

async function getKV(store, key, fallback) {
  const record = await get(store, key);
  return record ? record.value : fallback;
}

async function setKV(store, key, value) {
  const sync = syncActive() && isSynced(store) && !isLocalKey(store, key);
  const tx = (await openDB()).transaction(sync ? [store, OUTBOX] : store, 'readwrite');
  const record = { key, value, updatedAt: nowISO() };
  tx.objectStore(store).put(record);
  if (sync) writeOutbox(tx, { store, id: key, op: 'put', record }, uid());
  await finished(tx);
  if (sync) afterLocalWrite();
}

export {getAll, count, get, getByIndex, getKV, setKV};
