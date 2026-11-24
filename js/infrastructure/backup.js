import { STORE_NAMES, KEYED } from './db/schema.js';
import { readAllStores, replaceAllStores } from './repositories/backupRepository.js';
import { setKV } from './db/store.js';
import { customerStatement, invoiceTotals } from '../domain/accounting.js';
import { makeZip } from '../core/zip.js';
import { buildExpenseMonthFiles } from './expenseFiles.js';
import { saveBlobAs } from './fileSave.js';
export const APP = 'workshop-system', APP_VERSION = '1.0.0', SCHEMA = 1;

export async function buildBackup() {
  const stores = await readAllStores(), counts = Object.fromEntries(STORE_NAMES.map(s => [s, stores[s].length]));
  return { app: APP, appVersion: APP_VERSION, schemaVersion: SCHEMA, exportedAt: new Date().toISOString(), storeNames: STORE_NAMES, counts, stores };
}
export function validateBackup(o) {
  if (!o || typeof o !== 'object' || o.app !== APP) throw new Error('الملف ليس نسخة احتياطية صالحة لهذا النظام');
  if (!Number.isInteger(o.schemaVersion) || o.schemaVersion < 1) throw new Error('رقم إصدار المخطط غير صالح');
  if (o.schemaVersion > SCHEMA) throw new Error('النسخة من إصدار أحدث غير مدعوم في هذا التطبيق');
  for (const s of STORE_NAMES) {
    const a = o.stores?.[s]; if (!Array.isArray(a)) throw new Error(`المخزن مفقود أو تالف: ${s}`);
    const kp = KEYED.includes(s) ? 'key' : 'id';
    if (a.some(r => !r || typeof r !== 'object' || typeof r[kp] !== 'string')) throw new Error(`سجل غير صالح في المخزن: ${s}`);
  }
  if (o.stores.payments.some(p => !Number.isInteger(p.amountPiastres))) throw new Error('مبلغ دفعة غير صالح في النسخة');
  return o;
}
const pad = n => String(n).padStart(2, '0');
export async function downloadBackup() {
  const name = `workshop-backup-${fileStamp()}.json`;
  let data;
  const saved = await saveBlobAs({ name, type: 'application/json', extension: 'json', build: async () => {
    data = await buildBackup();
    return new Blob([JSON.stringify(data)], { type: 'application/json' });
  } });
  await setKV('metadata', 'lastExportAt', data.exportedAt);
  return { name: saved.name, at: data.exportedAt };
}
export const restoreBackup = o => replaceAllStores(validateBackup(o).stores);

// ===== نسخة مفصلة: مجلد لكل عميل بكل معاملاته =====
export const customerFolderName = c => safeName(c.phone ? `${c.name} - ${c.phone}` : c.name);
export const safeName = s => String(s ?? '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/\s+/g, ' ').replace(/[. ]+$/, '').trim().slice(0, 80) || 'بدون اسم';
const csvCell = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const egp = p => (p / 100).toFixed(2);
const json = o => JSON.stringify(o, null, 2);
/** دالة نقية: تبني قائمة ملفات {path,text} لكل عميل (بياناته، كشف حسابه CSV، كل فاتورة بدفعاتها ولقطات طباعتها، الدفعات غير المخصصة، سجل التدقيق). */
export function buildCustomerFiles(st) {
  const by = (a, k) => { const m = {}; a.forEach(x => (m[x[k]] ??= []).push(x)); return m; };
  const invByC = by(st.invoices, 'customerId'), payByC = by(st.payments, 'customerId'), itemsByInv = by(st.invoiceItems, 'invoiceId'), payByInv = by(st.payments.filter(p => p.invoiceId), 'invoiceId'), snapByInv = by(st.printSnapshots, 'invoiceId');
  const used = new Set(), out = [{ path: 'اقرأني.txt', text: 'مجلد العملاء: لكل عميل مجلد فيه بياناته وكشف حسابه (CSV يفتح في Excel) وفواتيره كاملة بدفعاتها ولقطات طباعتها.\nالاستعادة داخل النظام تتم من ملف النسخة الكاملة في مجلد «النسخ الكاملة» فقط.\n' }];
  for (const c of st.customers) {
    let folder = customerFolderName(c); if (used.has(folder.toLowerCase())) folder += ` - ${c.id.slice(0, 8)}`; used.add(folder.toLowerCase());
    const base = `العملاء/${folder}`, invs = [...(invByC[c.id] || [])].sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate)), pays = payByC[c.id] || [];
    const stmt = customerStatement(c, invs, itemsByInv, pays);
    const active = invs.filter(i => i.status === 'active'), net = active.reduce((s, i) => s + invoiceTotals(itemsByInv[i.id] || [], [], i).net, 0), paid = pays.filter(p => p.status === 'active').reduce((s, p) => s + p.amountPiastres, 0);
    out.push({ path: `${base}/بيانات العميل.json`, text: json({ العميل: c, الملخص: { 'عدد الفواتير': invs.length, 'إجمالي التعاقدات (جنيه)': egp(net), 'إجمالي المدفوع (جنيه)': egp(paid), 'الرصيد (جنيه، موجب = مستحق على العميل)': egp(stmt.length ? stmt[stmt.length - 1].balance : 0) } }) });
    out.push({ path: `${base}/كشف الحساب.csv`, text: '\ufeff' + [['التاريخ', 'الحركة', 'المرجع', 'مدين', 'دائن', 'الرصيد'], ...stmt.map(r => [r.date.slice(0, 10), r.type, r.ref ? String(r.ref).slice(0, 8) : '', r.debit ? egp(r.debit) : '', r.credit ? egp(r.credit) : '', egp(r.balance)])].map(r => r.map(csvCell).join(',')).join('\r\n') });
    for (const i of invs) out.push({ path: `${base}/الفواتير/فاتورة ${i.invoiceDate} ${i.id.slice(0, 8)}.json`, text: json({ الفاتورة: i, البنود: [...(itemsByInv[i.id] || [])].sort((a, b) => a.lineNo - b.lineNo), الدفعات: payByInv[i.id] || [], 'لقطات الطباعة': snapByInv[i.id] || [] }) });
    const free = pays.filter(p => !p.invoiceId); if (free.length) out.push({ path: `${base}/دفعات غير مخصصة.json`, text: json(free) });
    const ids = new Set([c.id, ...invs.map(i => i.id), ...pays.map(p => p.id)]), aud = st.auditLogs.filter(a => ids.has(a.refId));
    if (aud.length) out.push({ path: `${base}/سجل التدقيق.json`, text: json(aud) });
  }
  return out;
}
const fileStamp = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`; };
async function allFiles(ts = fileStamp()) { const data = await buildBackup(); return { data, ts, files: [{ path: `النسخ الكاملة/workshop-backup-${ts}.json`, text: JSON.stringify(data) }, ...buildCustomerFiles(data.stores), ...buildExpenseMonthFiles(data.stores)] }; }

// حفظ مقبض المجلد في قاعدة منفصلة (لا يدخل في النسخ الاحتياطية)
const hdb = () => new Promise((res, rej) => { const r = indexedDB.open('workshopHandles', 1); r.onupgradeneeded = () => r.result.createObjectStore('h'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
export async function saveHandle(h) { const db = await hdb(); return new Promise((res, rej) => { const tx = db.transaction('h', 'readwrite'); tx.objectStore('h').put(h, 'backupDir'); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }
export async function loadHandle() { const db = await hdb(); return new Promise((res, rej) => { const q = db.transaction('h').objectStore('h').get('backupDir'); q.onsuccess = () => res(q.result || null); q.onerror = () => rej(q.error); }); }
async function writeText(root, path, text) {
  const parts = path.split('/'), name = parts.pop(); let d = root;
  for (const p of parts) d = await d.getDirectoryHandle(p, { create: true });
  const w = await (await d.getFileHandle(name, { create: true })).createWritable(); await w.write(text); await w.close();
}
export async function backupToFolder(root) {
  const { data, files } = await allFiles();
  for (const f of files) await writeText(root, f.path, f.text);
  await setKV('metadata', 'lastExportAt', data.exportedAt);
  return { customers: data.counts.customers, files: files.length };
}
export async function downloadCustomerZip() {
  const ts = fileStamp(), name = `workshop-backup-folders-${ts}.zip`;
  let all;
  const saved = await saveBlobAs({ name, type: 'application/zip', extension: 'zip', build: async () => {
    all = await allFiles(ts);
    return makeZip(all.files);
  } });
  await setKV('metadata', 'lastExportAt', all.data.exportedAt);
  return { name: saved.name, customers: all.data.counts.customers, files: all.files.length };
}

/** كتابة ملف (نص أو بايتات) داخل مجلد محدد وإنشاء المجلدات الوسيطة. */
export async function writeFileTo(root, path, data) {
  const parts = path.split('/'), name = parts.pop(); let d = root;
  for (const p of parts) d = await d.getDirectoryHandle(p, { create: true });
  const w = await (await d.getFileHandle(name, { create: true })).createWritable(); await w.write(data); await w.close();
}
