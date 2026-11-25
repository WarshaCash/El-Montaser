import {el} from '../../../core/dom.js';
import {formatEGP} from '../../../core/formatters.js';

const HEADERS = ['الصنف', 'المواصفات', 'المقاس', 'الكمية', 'السعر', ''];

const priceText = (item) => (item.unitPricePiastres > 0 ? formatEGP(item.qty * item.unitPricePiastres) : '—');

function itemRow(item, index, onRemove) {
  const remove = el('button', { className: 'btn danger', type: 'button', textContent: 'حذف', onclick: () => onRemove(index) });
  return el('tr', {},
    el('td', { textContent: item.category }),
    el('td', { className: 'pre', textContent: item.description }),
    el('td', { className: 'pre', textContent: item.sizeText || '—' }),
    el('td', { textContent: item.qty }),
    el('td', { textContent: priceText(item) }),
    el('td', {}, remove));
}

/** جدول البنود المضافة (أو رسالة «لم تُضف بنود بعد»). */
function itemsTable(items, onRemove) {
  if (!items.length) return el('div', { className: 'empty', textContent: 'لم تُضف بنود بعد.' });
  return el('table', {},
    el('thead', {}, el('tr', {}, ...HEADERS.map((h) => el('th', { textContent: h })))),
    el('tbody', {}, ...items.map((item, index) => itemRow(item, index, onRemove))));
}

export {itemsTable};
