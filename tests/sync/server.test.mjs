// اختبار منطق خلفية Apps Script (Code.gs) كما هو: الحماية والتسلسل والتعارض والحذف وتكرار الدفعة وحجم السجل.
// التشغيل:  node tests/sync/server.test.mjs
import assert from 'node:assert/strict';
import { createBackend } from './harness.mjs';

let failed = 0;
const test = (name, fn) => { try { fn(); console.log('PASS', name); } catch (e) { failed++; console.log('FAIL', name, '\n  ', e.message); } };
const T = 'secret-token';
const put = (store, id, record) => ({ store, id, op: 'put', record: { id, updatedAt: new Date().toISOString(), ...record } });
const del = (store, id) => ({ store, id, op: 'delete' });

test('الحماية: بدون رمز أو برمز خاطئ يُرفض، والرمز الصحيح يمر', () => {
  const b = createBackend();
  assert.equal(b.post({ action: 'ping' }).code, 'auth');
  assert.equal(b.post({ action: 'ping', token: 'x' }).code, 'auth');
  assert.equal(b.post({ action: 'ping', token: T }).ok, true);
  assert.equal(b.get().ok, true);
  assert.equal(JSON.stringify(b.get()).includes('customers'), false); // GET لا يكشف بيانات
});

test('الإيقاف المؤقت بعد محاولات خاطئة كثيرة (حتى مع الرمز الصحيح)', () => {
  const b = createBackend();
  for (let i = 0; i < 8; i++) b.post({ action: 'ping', token: 'bad' });
  assert.equal(b.post({ action: 'ping', token: T }).code, 'locked');
});

test('غير مضبوط: بدون API_TOKEN يرفض كل شيء', () => {
  const b = createBackend(); b.props.delete('API_TOKEN');
  assert.equal(b.post({ action: 'ping', token: 'a' }).code, 'not_configured');
});

test('push يكتب ويرقّم rev ويُرجع ما فاته من الأجهزة الأخرى فقط', () => {
  const b = createBackend();
  const a = b.post({ action: 'push', token: T, dev: 'A', batch: 'b1', since: 0, changes: [put('customers', 'c1', { name: 'أحمد', phone: '01012345678' })] });
  assert.equal(a.rev, 1); assert.deepEqual(a.changes, []); // لا صدى لتغييرات الجهاز نفسه
  const bb = b.post({ action: 'push', token: T, dev: 'B', batch: 'b2', since: 0, changes: [put('customers', 'c2', { name: 'محمود', phone: '01112345678' })] });
  assert.equal(bb.rev, 2); assert.equal(bb.changes.length, 1); assert.equal(bb.changes[0].id, 'c1');
  const pa = b.post({ action: 'pull', token: T, dev: 'A', since: 1 });
  assert.deepEqual(pa.changes.map((c) => c.id), ['c2']);
});

test('الاستعلام الفارغ لا يقرأ أي ورقة (سريع)', () => {
  const b = createBackend();
  b.post({ action: 'push', token: T, dev: 'A', batch: 'x', since: 0, changes: [put('customers', 'c1', { name: 'س' })] });
  const calls = () => [...b.sheets.values()].reduce((s, sh) => s + sh.calls, 0);
  const before = calls();
  const r = b.post({ action: 'pull', token: T, dev: 'B', since: 1 });
  assert.equal(r.changes.length, 0); assert.equal(calls(), before);
});

test('الأحدث يفوز، والقديم المتأخر يُتجاهل', () => {
  const b = createBackend();
  const rec = (name, at) => ({ store: 'customers', id: 'c1', op: 'put', record: { id: 'c1', name, updatedAt: at } });
  b.post({ action: 'push', token: T, dev: 'A', batch: '1', since: 0, changes: [rec('جديد', '2026-11-02T10:00:00.000Z')] });
  b.post({ action: 'push', token: T, dev: 'B', batch: '2', since: 0, changes: [rec('قديم', '2026-11-01T10:00:00.000Z')] });
  const snap = b.post({ action: 'snapshot', token: T });
  assert.equal(snap.stores.customers.length, 1); assert.equal(snap.stores.customers[0].name, 'جديد');
});

test('الحذف يصل للأجهزة الأخرى ويُخرج السجل من اللقطة، ولا يعود بتعديل متأخر', () => {
  const b = createBackend();
  b.post({ action: 'push', token: T, dev: 'A', batch: '1', since: 0, changes: [put('invoices', 'i1', { status: 'active' })] });
  const d = b.post({ action: 'push', token: T, dev: 'A', batch: '2', since: 1, changes: [del('invoices', 'i1')] });
  assert.equal(d.rev, 2);
  const p = b.post({ action: 'pull', token: T, dev: 'B', since: 1 });
  assert.deepEqual(p.changes.map((c) => c.op), ['delete']);
  b.post({ action: 'push', token: T, dev: 'B', batch: '3', since: 2, changes: [put('invoices', 'i1', { status: 'zombie' })] });
  assert.equal(b.post({ action: 'snapshot', token: T }).stores.invoices.length, 0);
});

test('إعادة إرسال نفس الدفعة بعد انقطاع لا تُطبَّق مرتين', () => {
  const b = createBackend();
  const req = { action: 'push', token: T, dev: 'A', batch: 'same', since: 0, changes: [put('payments', 'p1', { amountPiastres: 50000 })] };
  assert.equal(b.post(req).rev, 1);
  assert.equal(b.post(req).rev, 1);
  assert.equal(b.post({ action: 'snapshot', token: T }).stores.payments.length, 1);
});

test('اللقطة تحمل كل المخازن وrev الحالي، وclient بـ rev أكبر من الخادم يُطلب منه إعادة التنزيل', () => {
  const b = createBackend();
  b.post({ action: 'push', token: T, dev: 'A', batch: '1', since: 0, changes: [put('customers', 'c1', { name: 'أ' }), put('expenses', 'e1', { amountPiastres: 100 })] });
  const s = b.post({ action: 'snapshot', token: T });
  assert.equal(s.rev, 2); assert.equal(s.stores.customers.length, 1); assert.equal(s.stores.expenses.length, 1);
  assert.equal(b.post({ action: 'pull', token: T, dev: 'B', since: 99 }).reset, true);
});

test('الإعدادات (مفتاح ← قيمة) تتزامن بمعرّف المفتاح', () => {
  const b = createBackend();
  b.post({ action: 'push', token: T, dev: 'A', batch: '1', since: 0, changes: [{ store: 'settings', id: 'priceClause', op: 'put', record: { key: 'priceClause', value: 'نص', updatedAt: '2026-11-02T00:00:00.000Z' } }] });
  assert.equal(b.post({ action: 'snapshot', token: T }).stores.settings[0].value, 'نص');
});

test('سجل كبير (فوق 45 ألف حرف) يُقسَّم ويُستعاد كاملاً، وأكبر من الحد يُرفض بوضوح', () => {
  const b = createBackend();
  const big = 'ب'.repeat(100000);
  b.post({ action: 'push', token: T, dev: 'A', batch: '1', since: 0, changes: [put('printSnapshots', 's1', { blob: big })] });
  assert.equal(b.post({ action: 'snapshot', token: T }).stores.printSnapshots[0].blob.length, 100000);
  const r = b.post({ action: 'push', token: T, dev: 'A', batch: '2', since: 1, changes: [put('printSnapshots', 's2', { blob: 'ب'.repeat(200000) })] });
  assert.equal(r.ok, false);
});

test('الحقول المقروءة: الهاتف يبقى نصاً بصفر البداية، والمبالغ بالجنيه', () => {
  const b = createBackend();
  b.post({ action: 'push', token: T, dev: 'A', batch: '1', since: 0, changes: [put('customers', 'c1', { name: 'سيد', phone: '01012345678', openingBalancePiastres: 12550 })] });
  const row = b.sheets.get('العملاء').rows[1];
  assert.equal(row[5], '01012345678'); assert.equal(row[6], '125.5');
});

test('تسلسل rev بلا فجوات عبر دفعات متتالية من أجهزة مختلفة (1000 تغيير)', () => {
  const b = createBackend();
  for (let i = 0; i < 10; i++) {
    const changes = Array.from({ length: 100 }, (_, j) => put('auditLogs', `a${i}-${j}`, { action: 'x' }));
    assert.equal(b.post({ action: 'push', token: T, dev: i % 2 ? 'A' : 'B', batch: 'b' + i, since: 0, changes }).ok, true);
  }
  assert.equal(b.post({ action: 'ping', token: T }).rev, 1000);
  const p1 = b.post({ action: 'pull', token: T, dev: 'Z', since: 0 });
  assert.equal(p1.changes.length, 1000); assert.equal(p1.more, false);
  assert.deepEqual(p1.changes.map((c) => c.rev), Array.from({ length: 1000 }, (_, i) => i + 1));
});

console.log(failed ? `\n${failed} فشل` : '\nكل اختبارات الخادم نجحت');
process.exit(failed ? 1 : 0);
