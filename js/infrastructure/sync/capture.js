// يلفّ معاملة IndexedDB بحيث تُسجَّل كل كتابة (add/put/delete) في صندوق الصادر ضمن المعاملة نفسها.
// الشاشات والمستودعات لا تعرف بوجود المزامنة: تكتب كما كانت تكتب تماماً.
import { idOf, isSynced } from '../db/schema.js';
import { isLocalKey } from './state.js';
import { writeOutbox } from './outbox.js';

const WRITES = new Set(['add', 'put', 'delete']);

function track(raw, batch, store, method, args) {
  if (!isSynced(store)) return;
  if (method === 'delete') {
    if (!isLocalKey(store, args[0])) writeOutbox(raw, { store, id: args[0], op: 'delete' }, batch);
    return;
  }
  const record = args[0];
  const id = idOf(store, record);
  if (!isLocalKey(store, id)) writeOutbox(raw, { store, id, op: 'put', record: structuredClone(record) }, batch);
}

function captureStore(raw, batch, name) {
  const store = raw.objectStore(name);
  return new Proxy(store, {
    get(target, prop) {
      const value = target[prop];
      if (typeof value !== 'function') return value;
      if (!WRITES.has(prop)) return value.bind(target);
      return (...args) => {
        const request = value.apply(target, args);
        track(raw, batch, name, prop, args);
        return request;
      };
    },
  });
}

export function captureTransaction(raw, batch) {
  return new Proxy(raw, {
    get(target, prop) {
      if (prop === 'objectStore') return (name) => captureStore(target, batch, name);
      const value = target[prop];
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
