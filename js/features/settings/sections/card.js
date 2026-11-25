import {el} from '../../../core/dom.js';

/** بطاقة إعدادات بعنوان: الشكل الموحد لكل قسم في الشاشة. */
const settingsCard = (title, ...children) => el('div', { className: 'card' }, el('h3', { textContent: title }), ...children);

/** زر حفظ/تنفيذ عادي بنفس الشكل في كل الأقسام. */
const actionButton = (text, onclick, { light = false, disabled = false } = {}) =>
  el('button', { className: light ? 'btn light' : 'btn', type: 'button', textContent: text, onclick, disabled });

export {settingsCard, actionButton};
