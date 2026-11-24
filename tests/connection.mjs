// اختبار فتح قاعدة البيانات (connection.js) بلا متصفح: indexedDB مزيّف يفشل أولاً ثم ينجح.
// التشغيل:  node tests/connection.mjs      (لا يحتاج أي حزم)
import { pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${ok ? '' : extra}`); };

let opens = 0, plan = [], alerts = [];
const dbs = [];
globalThis.alert = (m) => alerts.push(m);
globalThis.indexedDB = {
  open() {
    opens++;
    const req = {}, step = plan.shift() || 'success';
    queueMicrotask(() => {
      if (step === 'error') { req.error = new Error('مرفوض'); req.onerror(); }
      else if (step === 'throw') return;
      else if (step === 'blocked') { req.onblocked(); req.result = mk(); req.onsuccess(); }
      else { req.result = mk(); req.onsuccess(); }
    });
    if (step === 'throw') { opens--; throw new Error('IndexedDB غير متاح'); }
    return req;
  },
};
const mk = () => { const d = { closed: false, close() { d.closed = true; } }; dbs.push(d); return d; };

const { openDB } = await import(pathToFileURL(resolve(root, 'js/infrastructure/db/connection.js')).href);
const fails = async (p) => { try { await p; return false; } catch { return true; } };

plan = ['error'];
check('فشل الفتح الأول يُرفض برسالة مفهومة', await fails(openDB()));
const db1 = await openDB();
check('الطلب التالي بعد الفشل يعيد المحاولة وينجح (لا يبقى وعد مرفوض)', !!db1 && opens === 2, `opens=${opens}`);
check('الطلبات اللاحقة تعيد الاتصال نفسه بلا فتح جديد', (await openDB()) === db1 && opens === 2);

db1.onclose();
const db2 = await openDB();
check('إغلاق المتصفح للقاعدة يُعاد فتحه عند أول طلب', db2 !== db1 && opens === 3, `opens=${opens}`);

db2.onversionchange();
const db3 = await openDB();
check('تغيّر الإصدار من تبويب آخر يغلق الاتصال ويُنبّه ثم يعيد الفتح', db2.closed && db3 !== db2 && alerts.some(a => a.includes('أعد تحميل')));

alerts.length = 0; plan = ['blocked']; db3.onclose();
await openDB();
check('الفتح المعلّق بسبب نافذة أخرى ينبّه المستخدم ثم يكتمل', alerts.length === 1 && alerts[0].includes('أغلق'));

plan = ['throw']; (await openDB()).onclose();
check('خطأ متزامن من indexedDB.open يُرفض ثم تنجح المحاولة التالية', await fails(openDB()) && !!(await openDB()));

const failed = results.filter(r => !r).length;
console.log(failed ? `\n${failed} اختبار فشل` : `\nكل اختبارات الاتصال نجحت (${results.length})`);
process.exit(failed ? 1 : 0);
