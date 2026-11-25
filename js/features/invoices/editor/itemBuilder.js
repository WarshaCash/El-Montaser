// بطاقة «إضافة بند جديد»: نوع العفش ← تفاصيله ← الكمية والسعر، مع شريط حالة يوضح الناقص.

import {el} from '../../../core/dom.js';
import {parsePiastres} from '../../../core/formatters.js';
import {getConfig, normalize} from '../../../domain/catalog/catalog.js';
import {btn, lab, stepper, suffix} from '../../../ui/controls.js';
import {icon} from '../../../ui/ui.js';
import {CAT_FALLBACK, CAT_ICONS} from '../categoryIcons.js';
import {fieldsFor} from '../itemFields/index.js';

const step = (number, title, ...children) => {
  const titleNode = typeof title === 'string' ? el('span', { textContent: title }) : title;
  return el('section', { className: 'step' },
    el('div', { className: 'step-h' }, el('b', { textContent: number }), titleNode),
    ...children);
};

const defaultCategory = () => getConfig().categories[0]?.name || '';

/** onAdd(item): يُستدعى عند اكتمال البند وإضافته. يعيد { card }. */
function createItemBuilder({ onAdd }) {
  let category = defaultCategory();
  let fields = null;

  const qty = el('input', { type: 'number', min: 1, max: 999, step: 1, value: 1, inputMode: 'numeric' });
  const price = el('input', { placeholder: 'اتركه فارغاً إن لم تُسعّر البند', inputMode: 'decimal' });
  const notes = el('input', { placeholder: 'مثال: اللون أو أي تفصيلة' });
  const box = el('div');
  const tiles = el('div', { className: 'cat-grid', role: 'radiogroup', ariaLabel: 'نوع العفش' });
  const detailsTitle = el('span');
  const status = el('div', { className: 'stat', role: 'status' });
  const addError = el('div', { className: 'err', role: 'alert' });

  const parseQty = (message) => {
    const q = Number(qty.value);
    if (!Number.isInteger(q) || q < 1) throw new Error(message);
    return q;
  };

  /** سعر البند اختياري: الفارغ = بلا سعر (يمكن كتابة إجمالي الفاتورة كاملاً بدلاً منه). */
  const parsePrice = () => {
    if (!price.value.trim()) return 0;
    let piastres;
    try { piastres = parsePiastres(price.value); } catch { throw new Error('سعر البند غير صالح'); }
    if (piastres < 0) throw new Error('سعر البند لا يكون سالباً');
    return piastres;
  };

  /** شريط الحالة: ما الناقص قبل «إضافة»، وملخص ما سيُضاف عند الاكتمال. */
  const updateStatus = () => {
    let message = null;
    let description = '';
    try {
      const normalized = normalize(category, fields.read());
      parseQty('الكمية يجب أن تكون 1 أو أكثر');
      parsePrice();
      description = (normalized.description || '').split('\n').join(' • ');
    } catch (error) { message = error.message; }
    status.className = 'stat ' + (message ? 'warn' : 'ok');
    const headline = el('b', { textContent: message ? `ناقص: ${message}` : 'جاهز للإضافة ✓' });
    status.replaceChildren(headline, message || !description ? '' : el('span', { textContent: description }));
  };

  const showCategory = () => {
    fields = fieldsFor(category, updateStatus);
    box.replaceChildren(fields.root);
    detailsTitle.textContent = `حدّد تفاصيل «${category}»`;
    tiles.querySelectorAll('.cat-tile').forEach((tile) => {
      const on = tile.dataset.v === category;
      tile.classList.toggle('on', on);
      tile.setAttribute('aria-checked', String(on));
    });
    updateStatus();
  };

  getConfig().categories.forEach((c) => {
    const select = () => { if (category !== c.name) { category = c.name; showCategory(); } };
    const tile = btn('cat-tile', [icon(CAT_ICONS[c.id] || CAT_FALLBACK), el('span', { textContent: c.name })], select, { role: 'radio' });
    tile.dataset.v = c.name;
    tiles.append(tile);
  });
  qty.oninput = price.oninput = updateStatus;
  showCategory();

  const buildItem = () => {
    const normalized = normalize(category, fields.read());
    const q = parseQty('الكمية يجب أن تكون عدداً صحيحاً موجباً');
    return {
      category, specs: normalized.specs, description: normalized.description, lines: normalized.lines || null,
      sizeText: normalized.sizeText || '',
      qty: q, unitPricePiastres: parsePrice(), notes: notes.value.trim(),
    };
  };
  const resetInputs = () => { price.value = ''; notes.value = ''; qty.value = 1; };

  const addButton = el('button', { className: 'btn add-btn', type: 'button', textContent: '＋ إضافة هذا البند إلى الفاتورة', onclick: () => {
    addError.textContent = '';
    try {
      const item = buildItem();
      resetInputs();
      showCategory();
      onAdd(item);
    } catch (error) {
      addError.textContent = error.message;
      fields.mark();
      addError.scrollIntoView({ block: 'nearest' });
    }
  } });

  const card = el('div', { className: 'card no-print builder' }, el('h3', { textContent: 'إضافة بند جديد' }),
    step(1, 'اختر نوع العفش', tiles), step(2, detailsTitle, box),
    step(3, 'الكمية والسعر', el('div', { className: 'row' },
      lab('الكمية', stepper(qty, 1, 999)), lab('سعر البند بالجنيه للوحدة (اختياري)', suffix(price, 'ج.م')),
  lab('ملاحظات (اختياري)', notes))),
    status, addError, el('div', { className: 'add-row' }, addButton));
  return { card };
}

export {createItemBuilder};
