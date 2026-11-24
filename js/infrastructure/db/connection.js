// الاتصال بقاعدة IndexedDB وتحويل طلباتها إلى Promise. لا منطق عمل هنا.
import { DATABASE_NAME, DATABASE_VERSION, migrations } from './schema.js';

let databaseName = DATABASE_NAME;
let opening = null;

/** يغيّر اسم القاعدة قبل أول فتح (للاختبارات فقط، حتى لا تلمس بيانات المستخدم). */
export function useDatabase(name) {
  if (opening) throw new Error('القاعدة مفتوحة بالفعل');
  databaseName = name;
}

function upgrade(event, db) {
  for (let version = event.oldVersion + 1; version <= event.newVersion; version++) migrations[version](db);
}

export function openDB() {
  if (opening) return opening;
  const attempt = new Promise((resolve, reject) => {
    const req = indexedDB.open(databaseName, DATABASE_VERSION);
    req.onupgradeneeded = (event) => upgrade(event, req.result);
    // التحديث معلّق لأن نافذة أخرى للنظام ما زالت تفتح الإصدار القديم: يكتمل الفتح تلقائياً حين تُغلق
    req.onblocked = () => alert('أغلق بقية نوافذ النظام المفتوحة في المتصفح ليكتمل تحديث قاعدة البيانات.');
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        opening = null;
        alert('تم تحديث النظام في تبويب آخر، أعد تحميل الصفحة.');
      };
      db.onclose = () => { opening = null; }; // أغلقها المتصفح من نفسه (نفاد التخزين أو مسح البيانات): يُعاد الفتح عند أول طلب
      resolve(db);
    };
    req.onerror = () => reject(new Error('تعذّر فتح قاعدة البيانات: ' + (req.error?.message || '')));
  });
  opening = attempt;
  // فشل الفتح لا يُحفظ: الطلب التالي يحاول من جديد بدل أن يبقى الوعد المرفوض إلى أن تُعاد الصفحة
  attempt.catch(() => { if (opening === attempt) opening = null; });
  return attempt;
}

/** ينتظر نتيجة طلب IndexedDB واحد. */
export const request = (req) => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

/** ينتظر اكتمال المعاملة، ويرفض إن أُلغيت. */
export const finished = (tx) => new Promise((resolve, reject) => {
  tx.oncomplete = resolve;
  tx.onabort = () => reject(tx.error || new Error('أُلغيت المعاملة'));
});
