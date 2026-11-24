// حالة المزامنة على هذا الجهاز (معرّف الجهاز وآخر rev وهل رُبط) في localStorage: خارج قاعدة البيانات
// فلا تدخل في النسخ الاحتياطي ولا تتزامن. الرابط والرمز يأتيان من الكود (config/syncConfig.js) ولا يُحفظان هنا.
import { uid } from '../../core/formatters.js';
import { SYNC_CONFIG } from '../../config/syncConfig.js';

const KEY = 'workshopSync';

/** إعدادات خاصة بالجهاز (طابعته وتفضيلاته) لا تُرسل إلى الشيت. */
const LOCAL_SETTINGS = new Set(['autoPdf', 'pageNumbers', 'printLayout', 'printLayoutOpts', 'backupReminderDays']);
export const isLocalKey = (store, key) => store === 'settings' && LOCAL_SETTINGS.has(key);

let cache = null;

function read() {
  try { return JSON.parse(globalThis.localStorage?.getItem(KEY) || '{}'); } catch { return {}; }
}

export function patchSync(patch) {
  cache = { ...(cache || read()), ...patch };
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify(cache)); } catch { /* التخزين غير متاح */ }
}

export function syncConfig() {
  if (!cache) cache = read();
  if (!cache.deviceId) patchSync({ deviceId: uid() });
  const url = SYNC_CONFIG.scriptUrl;
  return {
    url,
    token: SYNC_CONFIG.token,
    deviceId: cache.deviceId,
    rev: Number(cache.rev) || 0,
    // «مربوط» يعني أُجري الدمج الأول مع هذا الشيت بالذات؛ تغيير الرابط في الكود يعيد الربط تلقائياً
    linked: !!cache.linked && cache.linkedUrl === url,
  };
}

/** المزامنة فعّالة فقط حين يوجد رابط ورمز في الكود؛ غير ذلك يعمل النظام محلياً. */
export const syncActive = () => { const c = syncConfig(); return !!(c.url && c.token); };

let writeHook = () => {};
/** المحرّك يسجّل هنا ليُنبَّه بعد كل كتابة محلية ناجحة. */
export const onLocalWrite = (fn) => { writeHook = fn; };
export const afterLocalWrite = () => writeHook();
