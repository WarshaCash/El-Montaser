import {el} from '../../../core/dom.js';
import {backupToFolder, downloadCustomerZip, saveHandle, loadHandle} from '../../../infrastructure/backup.js';
import {settingsCard, actionButton} from './card.js';

const canPickFolder = () => typeof window.showDirectoryPicker === 'function';

async function ensureWritePermission(handle) {
  const options = { mode: 'readwrite' };
  const granted = (await handle.queryPermission(options)) === 'granted' || (await handle.requestPermission(options)) === 'granted';
  if (!granted) throw new Error('لم يُمنح إذن الكتابة في المجلد');
}

/** نسخة مفصلة: مجلد لكل عميل وملف مستقل لكل شهر مصروفات، إما داخل مجلد يختاره المستخدم أو كملف ZIP. */
async function folderBackupSection({ notice, session }) {
  const supported = canPickFolder();
  const folderLabel = el('p', { textContent: 'لم يُحدَّد مجلد بعد.' });
  let folder = null;
  loadHandle().then((handle) => {
    folder = handle;
    if (handle) folderLabel.textContent = `المجلد المحدد: ${handle.name}`;
  }).catch(() => {});

  const pick = actionButton('اختيار / تغيير مجلد النسخ', async () => {
    notice.clearError();
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite', id: 'workshop-backup' });
      await saveHandle(handle);
      folder = handle;
      folderLabel.textContent = `المجلد المحدد: ${handle.name}`;
    } catch (error) { if (error.name !== 'AbortError') notice.fail('تعذّر اختيار المجلد: ' + error.message); }
  }, { disabled: !supported });

  const run = actionButton('نسخ احتياطي إلى المجلد (لكل عميل + لكل شهر)', async () => {
    notice.clearError();
    notice.done('');
    if (!folder) return notice.fail('اختر مجلد النسخ أولاً.');
    try {
      await ensureWritePermission(folder);
      run.disabled = true;
      const result = await backupToFolder(folder);
      notice.done(`تم الحفظ في «${folder.name}»: ${result.customers} عميل، ${result.files} ملفاً.`);
      await session.markDone();
    } catch (error) { notice.fail('فشل النسخ إلى المجلد: ' + error.message); } finally { run.disabled = !supported; }
  }, { disabled: !supported });

  const zip = actionButton('تنزيل نسخة مفصلة ZIP (لكل عميل + لكل شهر)', async () => {
    notice.clearError();
    try {
      const result = await downloadCustomerZip();
      notice.done(`بدأ تنزيل ${result.name} (${result.customers} عميل، ${result.files} ملفاً).`);
      await session.markDone();
    } catch (error) { notice.fail(error.message); }
  });
  const actions = el('div', { className: 'actions' }, ...(supported ? [pick, run] : []), zip);
  return settingsCard('نسخة مفصلة: مجلد لكل عميل وملف لكل شهر مصروفات', supported ? folderLabel : '', actions);
}

export {folderBackupSection};
