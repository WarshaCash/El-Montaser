// يشغّل apps-script/Code.gs نفسه داخل Node مع نسخ وهمية من خدمات جوجل (الشيت والقفل والخصائص والكاش).
// يُستعمل لاختبار منطق الخادم الحقيقي بدون حساب جوجل: ما يجتاز هنا يعمل بنفس المنطق على Apps Script.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';

const CODE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'apps-script', 'Code.gs');

class FakeSheet {
  constructor(name) { this.name = name; this.rows = []; this.max = 1000; this.calls = 0; }
  getLastRow() { for (let i = this.rows.length - 1; i >= 0; i--) if (this.rows[i] && this.rows[i].some((v) => v !== '' && v !== undefined)) return i + 1; return 0; }
  getMaxRows() { return this.max; }
  insertRowsAfter(_after, n) { this.max += n; }
  setFrozenRows() {} setRightToLeft() {}
  getRange(row, col, nr = 1, nc = 1) {
    const sheet = this;
    if (row + nr - 1 > sheet.max) throw new Error('range outside sheet dimensions');
    return {
      getValues() { sheet.calls++; return Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (sheet.rows[row - 1 + i]?.[col - 1 + j] ?? ''))); },
      setValues(values) { sheet.calls++; values.forEach((r, i) => r.forEach((v, j) => { (sheet.rows[row - 1 + i] ||= [])[col - 1 + j] = v; })); },
      setNumberFormat() {},
    };
  }
}

export function createBackend({ token = 'secret-token' } = {}) {
  const sheets = new Map(), props = new Map([['API_TOKEN', token]]), cache = new Map();
  const ss = {
    getSheetByName: (n) => sheets.get(n) || null,
    insertSheet: (n) => { const s = new FakeSheet(n); sheets.set(n, s); return s; },
  };
  const context = {
    console, JSON, Math, Date, String, Number, Object, Array,
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (props.has(k) ? props.get(k) : null), setProperty: (k, v) => props.set(k, String(v)) }) },
    CacheService: { getScriptCache: () => ({ get: (k) => cache.get(k) ?? null, put: (k, v) => cache.set(k, v), remove: (k) => cache.delete(k) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (text) => ({ text, setMimeType() { return this; }, getContent() { return text; } }) },
    Utilities: { getUuid: () => randomUUID() },
    Logger: { log() {} },
  };
  vm.createContext(context);
  vm.runInContext(readFileSync(CODE, 'utf8') + '\n;this.__doPost = doPost; this.__doGet = doGet; this.__setup = setup;', context);
  return {
    sheets, props,
    setup: () => context.__setup(),
    post: (body) => JSON.parse(context.__doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } }).getContent()),
    get: () => JSON.parse(context.__doGet().getContent()),
  };
}
