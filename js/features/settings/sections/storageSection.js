import { el } from '../../../core/dom.js';
import { getKV, setKV } from '../../../infrastructure/db/store.js';
import { lab } from '../../../ui/controls.js';
import { settingsCard, actionButton } from './card.js';

const MB = 1048576;

function storageEstimate() {
  const line = el('p', { textContent: '…' });
  (async () => {
    const estimate = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
    const used = estimate && (estimate.usage / MB).toFixed(2);
    const quota = estimate && (estimate.quota / MB).toFixed(0);
    line.textContent = estimate ? `المستخدم تقريباً: ${used} م.ب من ${quota} م.ب` : '';
  })();
  return line;
}

export async function storageSection({ notice }) {
  const days = el('input', { type: 'number', min: 1, value: await getKV('settings', 'backupReminderDays', 7) });
  const saveDays = actionButton('حفظ', async () => {
    const n = Number(days.value);
    if (n >= 1) { await setKV('settings', 'backupReminderDays', n); notice.done('تم الحفظ'); }
  });
  const persist = actionButton('طلب تخزين دائم', async () => {
    const granted = navigator.storage?.persist ? await navigator.storage.persist() : false;
    notice.done(granted ? 'منح المتصفح التخزين الدائم' : 'لم يمنح المتصفح التخزين الدائم (القرار للمتصفح)');
  });
  const reminder = el('div', { className: 'row' }, lab('تنبيه النسخ الاحتياطي بعد (أيام)', days), saveDays);
  return settingsCard('التذكير والتخزين', reminder, storageEstimate(), persist);
}
