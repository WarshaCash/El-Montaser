// اختبارات تكامل طبقة البيانات على IndexedDB حقيقية (تعمل في المتصفح عبر tests.html / e2e.mjs).
// تستعمل قاعدة بيانات مؤقتة باسم فريد وتحذفها بعد الانتهاء، فلا تمس بيانات المستخدم أبداً.
import { useDatabase, openDB } from '../js/infrastructure/db/connection.js';
import { getAll, get, getByIndex, count, getKV, setKV } from '../js/infrastructure/db/store.js';
import { readAllStores, replaceAllStores } from '../js/infrastructure/repositories/backupRepository.js';
import { addCustomer, updateCustomer, deleteCustomer } from '../js/infrastructure/repositories/customerRepository.js';
import { saveInvoice, updateInvoice, deleteInvoice, addSnapshot } from '../js/infrastructure/repositories/invoiceRepository.js';
import { addPayment, addMoney, reverseRecord } from '../js/infrastructure/repositories/ledgerRepository.js';
import { listWorkers, addWorker, setWorkerActive } from '../js/infrastructure/repositories/workerRepository.js';

const rejects = async (fn, part) => {
  try { await fn(); } catch (e) { if (part && !e.message.includes(part)) throw new Error(`رسالة الخطأ «${e.message}» لا تحوي «${part}»`); return; }
  throw new Error('كان يجب أن يُرفض الطلب');
};
const same = (a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${JSON.stringify(a)} != ${JSON.stringify(b)}`); };
const actions = async () => (await getAll('auditLogs')).map(l => l.action);
const ITEMS = [{ category: 'مطبخ', description: '12 ضلفة', qty: 2, unitPricePiastres: 100000 }, { category: 'نيش', description: '2 ضلفة', qty: 1, unitPricePiastres: 50000 }];

export async function runRepositoryTests() {
  const out = [];
  const t = async (name, fn) => { try { await fn(); out.push([name, true]); } catch (e) { out.push([name, false, e.message]); } };
  const dbName = 'workshopDB_test_' + Math.random().toString(36).slice(2);
  useDatabase(dbName);
  await openDB();

  let customer;
  await t('قاعدة البيانات: إضافة عميل تضبط الهاتف وتسجل التدقيق', async () => {
    customer = await addCustomer({ name: 'عميل أول', phone: '٠١٠١٢٣٤٥٦٧٨' });
    same([customer.phone, customer.openingBalancePiastres, !!customer.id], ['01012345678', 0, true]);
    same((await actions()).includes('إضافة عميل'), true);
  });
  await t('قاعدة البيانات: تعديل عميل يرفض الاسم القصير ويسجّل القبل والبعد', async () => {
    await rejects(() => updateCustomer(customer.id, { name: ' ا ', phone: '01012345678' }), 'اسم العميل');
    const r = await updateCustomer(customer.id, { name: 'عميل معدّل', phone: '01012345678' });
    same(r.name, 'عميل معدّل');
    const log = (await getAll('auditLogs')).find(l => l.action === 'تعديل بيانات عميل');
    same(log.details.before.name, 'عميل أول');
  });
  await t('قاعدة البيانات: حذف عميل بلا حركة مالية ينجح ويُمنع لو له فاتورة', async () => {
    const lone = await addCustomer({ name: 'عميل وحيد', phone: '01222222222' });
    await deleteCustomer(lone.id);
    same(await get('customers', lone.id), undefined);
    const inv = await saveInvoice({ customerId: customer.id, invoiceDate: '2026-01-01' }, ITEMS);
    await rejects(() => deleteCustomer(customer.id), 'لا يمكن حذف');
    await deleteInvoice(inv.id, 'تنظيف اختبار', 'credit');
  });
  await t('قاعدة البيانات: عميل بلا هاتف (فاتورة استثنائية) يُعدَّل اسمه دون هاتف، ولا يُسمح بهاتف ناقص', async () => {
    const inv = await saveInvoice({ invoiceDate: '2026-02-10' }, ITEMS, { name: 'عميل استثنائي', phone: '' });
    const id = inv.customerId;
    same((await get('customers', id)).phone, '');
    same((await updateCustomer(id, { name: 'اسم بعد التعديل', phone: '' })).name, 'اسم بعد التعديل');
    await rejects(() => updateCustomer(id, { name: 'اسم بعد التعديل', phone: '0123' }), '11 رقماً');
    same((await updateCustomer(id, { name: 'اسم بعد التعديل', phone: '٠١٥٥٥٥٥٥٥٥٥' })).phone, '01555555555');
    await rejects(() => updateCustomer(id, { name: 'اسم بعد التعديل', phone: '' }), '11 رقماً'); // بعد أن صار له هاتف لا يُمحى
    await deleteInvoice(inv.id, 'تنظيف اختبار', 'credit'); await deleteCustomer(id);
  });
  await t('قاعدة البيانات: عميل له هاتف لا يُعدَّل بهاتف فارغ', async () => {
    await rejects(() => updateCustomer(customer.id, { name: 'عميل معدّل', phone: '' }), '11 رقماً');
  });

  let invoice, deposit;
  await t('قاعدة البيانات: حفظ فاتورة بعميل جديد وعربون يكتب كل السجلات معاً', async () => {
    invoice = await saveInvoice({ invoiceDate: '2026-02-01' }, ITEMS, { name: 'عميل الفاتورة', phone: '01111111111' }, { amountPiastres: 30000 });
    same(invoice.netContractPiastres, 250000);
    const items = await getByIndex('invoiceItems', 'invoiceId', invoice.id);
    same(items.map(i => [i.lineNo, i.totalPiastres]).sort(), [[1, 200000], [2, 50000]]);
    const pays = await getByIndex('payments', 'invoiceId', invoice.id);
    same([pays.length, pays[0].amountPiastres, pays[0].status, pays[0].paidAt], [1, 30000, 'active', '2026-02-01']);
    deposit = pays[0];
    const cash = await getByIndex('cashTransactions', 'refId', deposit.id);
    same([cash.length, cash[0].type, cash[0].sign, cash[0].amountPiastres], [1, 'receipt', 1, 30000]);
    const a = await actions();
    same(['إضافة عميل', 'تسجيل دفعة', 'إنشاء فاتورة'].every(x => a.includes(x)), true);
  });
  await t('قاعدة البيانات: الإجمالي الصريح للفاتورة يُحفظ كما هو، واسم العميل الجديد مطلوب', async () => {
    const inv = await saveInvoice({ customerId: customer.id, invoiceDate: '2026-02-02', netContractPiastres: 123400 }, ITEMS);
    same(inv.netContractPiastres, 123400);
    await rejects(() => saveInvoice({ invoiceDate: '2026-02-02' }, ITEMS, { name: 'ا', phone: '' }), 'اسم العميل');
    await deleteInvoice(inv.id, 'تنظيف', 'credit');
  });
  await t('قاعدة البيانات: الدفعة بنفس opId لا تتكرر', async () => {
    const p = { opId: 'op-1', invoiceId: invoice.id, customerId: invoice.customerId, amountPiastres: 10000, paidAt: '2026-02-03', method: 'نقدي', treasuryId: 'main' };
    const first = await addPayment(p);
    same(first.ok, true);
    same(await addPayment({ ...p }), { ok: false, duplicate: true });
    same((await getByIndex('payments', 'invoiceId', invoice.id)).length, 2);
  });
  await t('قاعدة البيانات: المصروف والإيراد يسجلان حركة خزينة بإشارتها', async () => {
    const e = await addMoney('expense', { category: 'خامات', amountPiastres: 7000, date: '2026-02-04', workshop: 'carpentry' });
    const i = await addMoney('income', { category: 'متفرقات', amountPiastres: 9000, date: '2026-02-04' });
    same((await getByIndex('cashTransactions', 'refId', e.id))[0].sign, -1);
    same((await getByIndex('cashTransactions', 'refId', i.id))[0].sign, 1);
  });
  await t('قاعدة البيانات: المصروف يُرفض بلا ورشة أو بمبلغ/تاريخ خاطئ، والبيان في الخزينة يذكر الورشة', async () => {
    const ok = { category: 'دهان', amountPiastres: 12000, date: '2026-02-05', workshop: 'paint' };
    await rejects(() => addMoney('expense', { ...ok, workshop: '' }), 'الورشة');
    await rejects(() => addMoney('expense', { ...ok, amountPiastres: -5 }), 'أكبر من صفر');
    await rejects(() => addMoney('expense', { ...ok, date: '' }), 'التاريخ');
    const before = (await getAll('expenses')).length;
    const e = await addMoney('expense', { ...ok, category: '  دهان  ' });
    same([e.category, e.workshop, (await getAll('expenses')).length], ['دهان', 'paint', before + 1]);
    same((await getByIndex('cashTransactions', 'refId', e.id))[0].label, 'دهان — ورشة الدهانات');
    await reverseRecord('expense', e.id, 'تنظيف اختبار');
  });
  await t('قاعدة البيانات: الصنايعية: إضافة بلا تكرار، وإيقاف/تفعيل، وبقاء مصروفاتهم', async () => {
    const before = (await listWorkers()).length;
    const w = await addWorker({ name: ' صنايعي اختبار ', workshop: 'carpentry', trade: 'نجار' });
    same([w.name, w.active, (await listWorkers()).length], ['صنايعي اختبار', true, before + 1]);
    await rejects(() => addWorker({ name: 'صنايعي اختبار', workshop: 'carpentry' }), 'مسجّل بالفعل');
    await rejects(() => addWorker({ name: '', workshop: 'carpentry' }), 'اسم الصنايعي');
    const pay = { date: '2026-02-06', salaryType: 'salary', workerId: w.id, workerName: w.name, workshop: 'carpentry', amountPiastres: 90000 };
    const e = await addMoney('expense', pay);
    same([e.category, e.workerId, e.salaryType], ['مرتبات الصنايعية', w.id, 'salary']);
    same((await getByIndex('cashTransactions', 'refId', e.id))[0].label, 'مرتبات الصنايعية — صنايعي اختبار — ورشة النجارة');
    await rejects(() => addMoney('expense', { ...pay, workerId: '' }), 'اختر الصنايعي');
    await setWorkerActive(w.id, false);
    same((await listWorkers()).find(x => x.id === w.id).active, false);
    same((await get('expenses', e.id)).workerName, 'صنايعي اختبار');
    await setWorkerActive(w.id, true); await reverseRecord('expense', e.id, 'تنظيف اختبار');
    await rejects(() => setWorkerActive('nope', true), 'غير موجود');
  });
  await t('قاعدة البيانات: الإلغاء بقيد عكسي يتطلب سبباً ولا يتكرر', async () => {
    await rejects(() => reverseRecord('payment', deposit.id, '  '), 'سبب الإلغاء');
    await reverseRecord('payment', deposit.id, 'خطأ في الإدخال');
    const p = await get('payments', deposit.id);
    same([p.status, p.reverseReason], ['reversed', 'خطأ في الإدخال']);
    const rev = (await getByIndex('cashTransactions', 'refId', deposit.id)).find(x => x.type === 'reversal');
    same([rev.sign, rev.amountPiastres], [-1, 30000]);
    await rejects(() => reverseRecord('payment', deposit.id, 'مرة ثانية'), 'غير فعّالة');
  });
  await t('قاعدة البيانات: إلغاء مصروف يعكس إشارته', async () => {
    const e = (await getAll('expenses')).find(x => x.status === 'active');
    await reverseRecord('expense', e.id, 'تكرار');
    const rev = (await getByIndex('cashTransactions', 'refId', e.id)).find(x => x.type === 'reversal');
    same(rev.sign, 1);
  });
  await t('قاعدة البيانات: تعديل فاتورة يستبدل البنود ويحفظ النسخة القديمة في التدقيق', async () => {
    await rejects(() => updateInvoice(invoice.id, { customerId: invoice.customerId, invoiceDate: '2026-02-05', netContractPiastres: 0 }, ITEMS), 'أكبر من صفر');
    const other = await addCustomer({ name: 'عميل آخر', phone: '01333333333' });
    await rejects(() => updateInvoice(invoice.id, { customerId: other.id, invoiceDate: '2026-02-05', netContractPiastres: 5000 }, ITEMS), 'تغيير العميل');
    const r = await updateInvoice(invoice.id, { customerId: invoice.customerId, invoiceDate: '2026-02-05', netContractPiastres: 99000 }, [ITEMS[0]]);
    same([r.netContractPiastres, r.invoiceDate], [99000, '2026-02-05']);
    same((await getByIndex('invoiceItems', 'invoiceId', invoice.id)).length, 1);
    const log = (await getAll('auditLogs')).find(l => l.action === 'تعديل فاتورة');
    same(log.details.before.items.length, 2);
  });
  await t('قاعدة البيانات: لقطة الطباعة تُحفظ مع تدقيق', async () => {
    const s = await addSnapshot({ invoiceId: invoice.id, version: 1, printedAt: '2026-02-06' });
    same((await getByIndex('printSnapshots', 'invoiceId', invoice.id)).length, 1);
    same(s.version, 1);
    same((await actions()).includes('طباعة نسخة فاتورة'), true);
  });
  await t('قاعدة البيانات: حذف فاتورة بوضع الرد يعكس الدفعات الفعالة ويفصلها', async () => {
    const inv = await saveInvoice({ customerId: customer.id, invoiceDate: '2026-03-01' }, ITEMS, null, { amountPiastres: 40000 });
    await addSnapshot({ invoiceId: inv.id, version: 1 });
    await rejects(() => deleteInvoice(inv.id, '', 'refund'), 'سبب الحذف');
    await rejects(() => deleteInvoice(inv.id, 'سبب', 'غير-صالح'), 'اختيار غير صالح');
    const [pay] = await getByIndex('payments', 'invoiceId', inv.id);
    await deleteInvoice(inv.id, 'طلب العميل', 'refund');
    same(await get('invoices', inv.id), undefined);
    same((await getByIndex('invoiceItems', 'invoiceId', inv.id)).length, 0);
    same((await getByIndex('printSnapshots', 'invoiceId', inv.id)).length, 0);
    const p = await get('payments', pay.id);
    same([p.status, p.invoiceId], ['reversed', null]);
    const rev = (await getByIndex('cashTransactions', 'refId', pay.id)).find(x => x.type === 'reversal');
    same(rev.sign, -1);
    const log = (await getAll('auditLogs')).find(l => l.action === 'حذف فاتورة نهائياً' && l.refId === inv.id);
    same([log.details.paymentsMode, log.details.printedCopies, log.details.items.length], ['refund', 1, 2]);
  });
  await t('قاعدة البيانات: حذف فاتورة بوضع الرصيد الدائن يُبقي الدفعة فعّالة بلا فاتورة', async () => {
    const inv = await saveInvoice({ customerId: customer.id, invoiceDate: '2026-03-02' }, ITEMS, null, { amountPiastres: 20000 });
    const [pay] = await getByIndex('payments', 'invoiceId', inv.id);
    await deleteInvoice(inv.id, 'إلغاء الطلب', 'credit');
    const p = await get('payments', pay.id);
    same([p.status, p.invoiceId, p.notes.includes('محذوفة')], ['active', null, true]);
    same((await getByIndex('cashTransactions', 'refId', pay.id)).some(x => x.type === 'reversal'), false);
  });
  await t('قاعدة البيانات: القيمة المفتاحية تُحفظ وتُقرأ وتُستبدل', async () => {
    same(await getKV('settings', 'k1', 'افتراضي'), 'افتراضي');
    await setKV('settings', 'k1', { a: 1 });
    same(await getKV('settings', 'k1', null), { a: 1 });
    await setKV('settings', 'k1', 2);
    same(await getKV('settings', 'k1', null), 2);
  });
  await t('قاعدة البيانات: العدّ والقراءة حسب الفهرس', async () => {
    same(await count('customers'), (await getAll('customers')).length);
    same((await getByIndex('payments', 'customerId', customer.id)).every(p => p.customerId === customer.id), true);
  });
  await t('قاعدة البيانات: الاستعادة الكاملة تعيد نفس المحتوى، والملف الناقص لا يمس البيانات', async () => {
    const snapshot = await readAllStores();
    await rejects(() => replaceAllStores({ ...snapshot, payments: undefined }));
    same((await readAllStores()).payments.length, snapshot.payments.length);
    await replaceAllStores({ ...snapshot, customers: snapshot.customers.slice(0, 1) });
    same(await count('customers'), 1);
    await replaceAllStores(snapshot);
    same(await readAllStores(), snapshot);
  });

  (await openDB()).close();
  await new Promise(res => { const r = indexedDB.deleteDatabase(dbName); r.onsuccess = r.onerror = r.onblocked = () => res(); });
  return out;
}
