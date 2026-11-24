// تنبيه النسخ الاحتياطي عند فتح التطبيق (بلا ادعاء مهمة خلفية).
import { el } from '../core/dom.js';
import { getKV, count } from '../infrastructure/db/store.js';

const DAY_MS = 864e5;

async function isReminderDue() {
  const last = await getKV('metadata', 'lastExportAt', null);
  const days = await getKV('settings', 'backupReminderDays', 7);
  const hasData = (await count('customers')) + (await count('invoices')) > 0;
  return { due: hasData && (!last || Date.now() - Date.parse(last) > days * DAY_MS), days };
}

export async function showBackupReminder() {
  try {
    const { due, days } = await isReminderDue();
    if (!due) return;
    const banner = el('div', { className: 'banner no-print' },
      `تنبيه: لم تُنشأ نسخة احتياطية منذ أكثر من ${days} أيام. `,
      el('a', { href: '#/settings', textContent: 'إنشاء نسخة الآن' }),
      el('button', { textContent: '×', onclick: () => banner.remove() }));
    document.querySelector('main').prepend(banner);
  } catch { /* التنبيه اختياري: لا يعطّل التطبيق */ }
}
