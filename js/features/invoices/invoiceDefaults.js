// قيم مساعدة مشتركة لشاشات الفاتورة.
import { getKV } from '../../infrastructure/db/store.js';
import { DEFAULT_CLAUSE } from './sheet.js';

export const clause = () => getKV('settings', 'priceClause', DEFAULT_CLAUSE);
export const today = () => new Date().toISOString().slice(0, 10);
