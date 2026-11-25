// محرّك المزامنة: القراءة دائماً من قاعدة الجهاز (فورية)، والكتابة تُحفظ محلياً أولاً ثم تُرسل للشيت في الخلفية.
//  - الإرسال: تغييرات الصندوق تُدمج وتُجمَّع دفعات (وقفة 0.7 ث) ويرجع في الرد ما استجد من الأجهزة الأخرى (رحلة واحدة).
//  - الاستقبال: استعلام خفيف كل 30 ثانية والتبويب ظاهر، وفوراً عند العودة للتبويب أو رجوع الإنترنت.
//  - الأعطال: انقطاع الإنترنت لا يضيّع شيئاً، فالتغييرات تبقى في الصندوق وتُرسل تلقائياً بإعادة محاولة تدريجية.

import {uid} from '../../core/formatters.js';
import {syncConfig, patchSync, syncActive, onLocalWrite} from './state.js';
import {call} from './remote.js';
import {readOutbox, countOutbox, deleteOutbox, coalesce} from './outbox.js';
import {applyChanges, mergeSnapshot, countLocalRecords, uploadAllLocal} from './applyRemote.js';

const OFFLINE_MESSAGE = 'لا يوجد اتصال بالإنترنت: تُحفظ تغييراتك على هذا الجهاز وتُرسل تلقائياً فور عودة الاتصال';
const isOffline = () => navigator.onLine === false;
const PUSH_CHUNK = 150, DEBOUNCE_MS = 700, POLL_MS = 30000, BACKOFF_MS = [3000, 6000, 10000, 15000];

let status = { state: 'off', pending: 0, lastSyncAt: null, message: '' };
const listeners = new Set();
const setStatus = (patch) => { status = { ...status, ...patch }; listeners.forEach((fn) => fn(status)); };

/** يشترك في تغيّر الحالة: off | idle | syncing | offline | error | auth. يُستدعى فوراً بالحالة الحالية. */
function onStatus(fn) { listeners.add(fn); fn(status); return () => listeners.delete(fn); }
const getStatus = () => status;

// عمليات المزامنة تُنفَّذ واحدة تلو الأخرى فلا يتداخل إرسال مع استقبال
let chain = Promise.resolve();
const exclusive = (task) => { const run = chain.then(task); chain = run.catch(() => {}); return run; };

let timer = null, failures = 0, started = false;
const schedule = (ms) => { clearTimeout(timer); timer = setTimeout(() => exclusive(() => cycle({ silent: true })).catch(() => {}), ms); };

async function absorb(response) {
  if (response.reset) { patchSync({ linked: false, rev: 0 }); await linkDevice(); return; }
  await applyChanges(response.changes || []);
  patchSync({ rev: response.rev });
}

async function pushAll() {
  for (;;) {
    const entries = await readOutbox();
    if (!entries.length) return;
    const groups = coalesce(entries).slice(0, PUSH_CHUNK);
    const response = await call('push', { batch: uid(), since: syncConfig().rev, changes: groups.map((g) => g.change) });
    await deleteOutbox(groups.flatMap((g) => g.seqs));
    await absorb(response);
    setStatus({ pending: await countOutbox() });
    if (response.more) await pullAll();
  }
}

async function pullAll() {
  for (;;) {
    const response = await call('pull', { since: syncConfig().rev });
    await absorb(response);
    if (response.reset || !response.more) return;
  }
}

/**
 * الربط الأول لهذا الجهاز بهذا الشيت (تلقائي بلا تدخل من المدير):
 * شيت فارغ ← يُرفع ما على الجهاز، وإلا ← دمج غير مدمّر (انظر mergeSnapshot). يُعاد تلقائياً إن تغيّر الشيت.
 */
async function linkDevice() {
  const info = await call('ping');
  if (info.rev === 0) {
    if (await countLocalRecords() > 0) await uploadAllLocal();
    patchSync({ linked: true, linkedUrl: syncConfig().url, rev: 0 });
    return;
  }
  const snapshot = await call('snapshot');
  await mergeSnapshot(snapshot);
  patchSync({ linked: true, linkedUrl: syncConfig().url, rev: snapshot.rev });
}

async function cycle({ silent = false } = {}) {
  if (!syncActive()) { setStatus({ state: 'off' }); return; }
  const pending = await countOutbox();
  if (isOffline()) { setStatus({ state: 'offline', pending, message: OFFLINE_MESSAGE }); return; }
  if (!silent || pending) setStatus({ state: 'syncing', pending });
  try {
    if (!syncConfig().linked) await linkDevice();
    await pushAll();
    await pullAll();
    failures = 0;
    setStatus({ state: 'idle', pending: await countOutbox(), lastSyncAt: Date.now(), message: '' });
    if (document.visibilityState !== 'hidden') schedule(POLL_MS);
  } catch (error) {
    const pendingNow = await countOutbox().catch(() => 0);
    if (error.code === 'auth' || error.code === 'locked') { setStatus({ state: 'auth', pending: pendingNow, message: error.message }); return; }
    setStatus({ state: error.code === 'network' ? 'offline' : 'error', pending: pendingNow, message: error.message });
    schedule(BACKOFF_MS[Math.min(failures++, BACKOFF_MS.length - 1)]);
  }
}

/** مزامنة فورية (زر «مزامنة الآن»). */
const syncNow = () => exclusive(() => cycle());

/** يبدأ التشغيل التلقائي: إرسال بعد كل كتابة، واستقبال دوري، واستئناف عند العودة للتبويب. */
function startSync() {
  if (!syncActive()) return;
  if (!started) {
    started = true;
    onLocalWrite(() => { clearTimeout(timer); timer = setTimeout(() => exclusive(() => cycle({ silent: true })).catch(() => {}), DEBOUNCE_MS); });
    addEventListener('online', () => syncNow().catch(() => {}));
    addEventListener('offline', () => countOutbox().then((pending) => setStatus({ state: 'offline', pending, message: OFFLINE_MESSAGE })).catch(() => {}));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow().catch(() => {}); });
    addEventListener('beforeunload', (event) => { if (status.pending > 0 && !isOffline()) { event.preventDefault(); event.returnValue = ''; } });
  }
  setStatus({ state: 'syncing' });
  exclusive(() => cycle()).catch(() => {});
}

/** ربط أول مرة قبل رسم الشاشات (جهاز جديد يرى بياناته من أول لحظة). يعيد false عند تعذّر الاتصال فيُكمل النظام محلياً ويعيد المحاولة. */
async function linkBeforeStart() {
  if (!syncActive() || syncConfig().linked) return true;
  try { await exclusive(linkDevice); return true; } catch { return false; }
}

export {onStatus, getStatus, syncNow, startSync, linkBeforeStart};
