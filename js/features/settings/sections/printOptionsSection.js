import {el} from '../../../core/dom.js';
import {getKV, setKV} from '../../../infrastructure/db/store.js';
import {applyPageNumbers} from '../../invoices/sheet.js';
import {settingsCard} from './card.js';

/** خانة اختيار تحفظ قيمتها فور تغييرها. */
async function savedCheckbox(key, fallback, notice, afterSave) {
  const box = el('input', { type: 'checkbox', checked: !!(await getKV('settings', key, fallback)) });
  box.onchange = async () => {
    await setKV('settings', key, box.checked);
    afterSave?.(box.checked);
    notice.done('تم حفظ إعداد الطباعة');
  };
  return box;
}

async function printOptionsSection({ notice }) {
  const pageNumbers = await savedCheckbox('pageNumbers', false, notice, applyPageNumbers);
  const autoPdf = await savedCheckbox('autoPdf', true, notice);
  return settingsCard('الطباعة',
    el('label', {}, autoPdf, ' حفظ نسخة PDF من الفاتورة باسم العميل عند الطباعة'),
    el('label', {}, pageNumbers, ' ترقيم الصفحات «صفحة 1 من N» أسفل الفاتورة (تجريبي)'));
}

export {printOptionsSection};
