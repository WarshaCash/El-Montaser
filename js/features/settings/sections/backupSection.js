import {el} from '../../../core/dom.js';
import {getKV} from '../../../infrastructure/db/store.js';
import {downloadBackup, validateBackup, restoreBackup} from '../../../infrastructure/backup.js';
import {settingsCard, actionButton} from './card.js';

const formatStamp = (iso) => new Date(iso).toLocaleString('en-GB');

function lastBackupLine() {
  const line = el('p');
  const refresh = async () => {
    const at = await getKV('metadata', 'lastExportAt', null);
    line.textContent = at ? `آخر نسخة احتياطية: ${formatStamp(at)}` : 'لم تُنشأ نسخة احتياطية بعد.';
  };
  return { line, refresh };
}

function previewOf(backup) {
  const rows = [
    ['تاريخ النسخة', formatStamp(backup.exportedAt)], ['العملاء', backup.counts.customers], ['الفواتير', backup.counts.invoices],
    ['الدفعات', backup.counts.payments], ['المصروفات', backup.counts.expenses], ['سجل التدقيق', backup.counts.auditLogs]];
  return [el('ul', {}, ...rows.map(([label, n]) => el('li', { textContent: `${label}: ${n}` }))),
    el('p', { className: 'err', textContent: 'تحذير: ستُستبدل كل البيانات الحالية بمحتوى هذه النسخة.' })];
}

/** الاستعادة: ملف ← معاينة ← تأكيد صريح ← استبدال كامل، ولا تُفعَّل قبل نسخة حالية. */
function restoreControls({ notice, session }) {
  const file = el('input', { type: 'file', accept: '.json,application/json' });
  const preview = el('div');
  const confirmBox = el('input', { type: 'checkbox' });
  const go = actionButton('استعادة (استبدال كامل)', null, { disabled: true });
  const gate = el('div', { className: 'hint' });
  let backup = null;

  const refreshGate = () => {
    go.disabled = !(backup && confirmBox.checked && session.done);
    gate.textContent = backup && !session.done ? 'أنشئ نسخة احتياطية حالية أولاً لتفعيل الاستعادة' : '';
  };
  file.onchange = async () => {
    backup = null;
    preview.replaceChildren();
    notice.clearError();
    refreshGate();
    try {
      backup = validateBackup(JSON.parse(await file.files[0].text()));
      refreshGate();
      preview.append(...previewOf(backup));
    } catch (error) { notice.fail('ملف مرفوض (لم تتغير البيانات): ' + error.message); }
  };
  confirmBox.onchange = refreshGate;
  go.onclick = async () => {
    go.disabled = true;
    try {
      await restoreBackup(backup);
      alert('تمت الاستعادة بنجاح');
      location.reload();
    } catch (error) {
      notice.fail('فشلت الاستعادة وبقيت البيانات القديمة: ' + error.message);
      refreshGate();
    }
  };
  session.onChange(refreshGate);
  const confirmLabel = el('label', {}, confirmBox, ' أفهم أن البيانات الحالية ستُستبدل');
  return [el('h4', { textContent: 'استعادة نسخة' }), file, preview, confirmLabel, el('div', {}, go), gate];
}

async function backupSection(ctx) {
  const { notice, session } = ctx;
  const { line, refresh } = lastBackupLine();
  await refresh();
  session.onChange(refresh);
  const create = actionButton('إنشاء نسخة احتياطية الآن', async () => {
    try {
      const result = await downloadBackup();
      notice.done(`تم إنشاء النسخة: ${result.name}`);
      await session.markDone();
    } catch (error) { notice.fail(error.message); }
  });
  return settingsCard('النسخ الاحتياطي والاستعادة', create, line, ...restoreControls(ctx), notice.error, notice.success);
}

export {backupSection};
