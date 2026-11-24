import { el } from '../../../core/dom.js';
import { getKV, setKV } from '../../../infrastructure/db/store.js';
import { DEFAULT_CLAUSE } from '../../invoices/sheet.js';
import { settingsCard, actionButton } from './card.js';

export async function priceClauseSection({ notice }) {
  const clause = el('textarea', { rows: 4, value: await getKV('settings', 'priceClause', DEFAULT_CLAUSE), className: 'wide' });
  const save = actionButton('حفظ النص', async () => { await setKV('settings', 'priceClause', clause.value); notice.done('تم حفظ النص'); });
  return settingsCard('شرط الأسعار في الفاتورة', clause, save);
}
