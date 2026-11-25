// مخطط قاعدة البيانات: أسماء المخازن وفهارسها والترحيلات المرقمة. لا يعرف شيئاً عن الاتصال.

const DATABASE_NAME = 'workshopDB';
const DATABASE_VERSION = 2;

/** مخازن السجلات: اسم المخزن ← الحقول المفهرسة. */
const INDEXED_STORES = {
  customers: ['name', 'phone'],
  invoices: ['customerId', 'invoiceDate', 'status'],
  invoiceItems: ['invoiceId'],
  payments: ['invoiceId', 'customerId', 'paidAt'],
  installments: ['invoiceId', 'dueDate'],
  treasuries: [],
  cashTransactions: ['treasuryId', 'date', 'refId'],
  expenses: ['date'],
  otherIncome: ['date'],
  settlements: ['customerId'],
  auditLogs: ['at'],
  printSnapshots: ['invoiceId', 'printedAt'],
};

/** مخازن «مفتاح ← قيمة» (الإعدادات والملفات والبيانات الوصفية). */
const KEYED = ['settings', 'files', 'metadata'];
const STORE_NAMES = [...Object.keys(INDEXED_STORES), ...KEYED];

/** صندوق الصادر: تغييرات هذا الجهاز التي لم تصل إلى Google Sheets بعد (لا يدخل في النسخ الاحتياطي ولا يتزامن). */
const OUTBOX = 'outbox';
/** المخازن التي تتزامن مع الشيت: كل شيء عدا الملفات والبيانات الوصفية الخاصة بالجهاز. */
const SYNCED_STORES = STORE_NAMES.filter((name) => !['files', 'metadata'].includes(name));
const isSynced = (name) => SYNCED_STORES.includes(name);
/** معرّف السجل في أي مخزن: مفتاح الإعدادات، أو id لباقي المخازن. */
const idOf = (name, record) => (KEYED.includes(name) ? record.key : record.id);

/** ترحيلات مرقمة: تضيف فقط ولا تمسح بيانات المستخدم. أضف رقماً جديداً عند أي تغيير في المخطط. */
const migrations = {
  1(db) {
    for (const [name, indexes] of Object.entries(INDEXED_STORES)) {
      const store = db.createObjectStore(name, { keyPath: 'id' });
      indexes.forEach((index) => store.createIndex(index, index));
      if (name === 'payments') store.createIndex('opId', 'opId', { unique: true });
    }
    for (const name of KEYED) db.createObjectStore(name, { keyPath: 'key' });
  },
  2(db) {
    db.createObjectStore(OUTBOX, { keyPath: 'seq', autoIncrement: true });
  },
};

export {DATABASE_NAME, DATABASE_VERSION, KEYED, STORE_NAMES, OUTBOX, SYNCED_STORES, isSynced, idOf, migrations};
