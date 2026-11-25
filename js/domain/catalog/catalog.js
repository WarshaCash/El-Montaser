// إعداد الأقسام والاستايلات الحالي + بوابة التحقق الموحدة normalize().
// قواعد كل نوع قسم في kinds/. المقاسات بالسنتيمتر دائماً.

import {DEFAULT_STYLES, DEFAULT_CATEGORIES} from './defaultCatalog.js';
import {getKind} from './kinds/index.js';

const FIXES = [[/الضرف/g, 'الضلف'], [/ضرفة/g, 'ضلفة']];
const fixWord = (s) => (typeof s === 'string' ? FIXES.reduce((acc, [from, to]) => acc.replace(from, to), s) : s);

/** ترحيل الإعدادات المحفوظة قديماً: الانتريه كان «نصاً ثابتاً» وصار نوعاً مستقلاً. */
const migrate = (cat) => {
  if (cat.id === 'entree' && cat.kind === 'fixed') return { id: cat.id, name: cat.name, kind: 'entree' };
  // الكراسي صارت تُكتب كتابةً: نرحّل الإعداد المحفوظ قديماً (أزرار) إلى الإدخال بالكتابة
  if (cat.id === 'dining' && cat.kind === 'count' && cat.input === undefined) return { ...cat, input: 'typed' };
  return cat;
};

/** نسخة منظّفة من الأقسام (تصحيح إملائي قديم + ترحيل). */
const cleanCategories = (list) =>
  list.filter((c) => c.kind !== 'free').map(migrate).map((c) => ({
    ...c,
    ...(c.label ? { label: fixWord(c.label) } : {}),
    ...(c.unit ? { unit: fixWord(c.unit) } : {}),
    ...(c.text ? { text: fixWord(c.text) } : {}),
  }));

let config = { styles: [...DEFAULT_STYLES], categories: cleanCategories(DEFAULT_CATEGORIES) };

const getConfig = () => config;

function setConfig(next) {
  const styles = Array.isArray(next?.styles) && next.styles.length ? next.styles.map(String) : [...DEFAULT_STYLES];
  const categories = Array.isArray(next?.categories) && next.categories.length ? cleanCategories(next.categories) : cleanCategories(DEFAULT_CATEGORIES);
  config = { styles, categories };
}

const findCategory = (name) => config.categories.find((c) => c.name === name) || null;

/** يتحقق من مواصفات البند حسب تعريف القسم الحالي ويعيد { specs, description, sizeText, lines? }؛ يرمي خطأً مفهوماً عند المخالفة. */
function normalize(categoryName, raw = {}) {
  const def = findCategory(categoryName);
  if (!def) throw new Error('قسم غير معروف');
  const kind = getKind(def.kind);
  if (!kind) throw new Error('نوع القسم غير مدعوم');
  return kind.normalize(def, raw, { styles: config.styles });
}

export {DEFAULT_STYLES, DEFAULT_CATEGORIES, getConfig, setConfig, findCategory, normalize};
