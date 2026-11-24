import { getKV, setKV } from './db/store.js';
import { setConfig, getConfig } from '../domain/catalog/catalog.js';
/** تحميل الأقسام والاستايلات من الإعدادات (أو الافتراضية) وتطبيقها. */
export async function loadCatalog() { setConfig(await getKV('settings', 'catalog', null)); return getConfig(); }
/** حفظ ذري في سجل واحد ثم تطبيقه. */
export async function saveCatalog(cfg) { await setKV('settings', 'catalog', { styles: cfg.styles, categories: cfg.categories }); setConfig(cfg); }
