// عناصر واجهة صغيرة قابلة لإعادة الاستخدام في كل الشاشات (لا تعرف شيئاً عن منطق العمل).

import {el} from '../core/dom.js';

/** حقل بعنوان نصي. */
const lab = (text, input) => el('label', { className: 'f' }, text + ' ', input);

/** قائمة منسدلة بخيار أول فارغ. */
const sel = (options, placeholder) =>
  el('select', {}, el('option', { value: '', textContent: placeholder }), ...options.map((o) => el('option', { value: o, textContent: o })));

/** زر عادي (type=button) مع سمات اختيارية. */
function btn(className, children, onclick, attrs = {}) {
  const b = el('button', { type: 'button', className, onclick }, ...[].concat(children));
  for (const [key, value] of Object.entries(attrs)) b.setAttribute(key, value);
  return b;
}

/** مجموعة أزرار لاختيار قيمة واحدة: كل الخيارات ظاهرة وتُختار بنقرة (بدل القوائم المنسدلة).
 *  options: نصوص أو أزواج [قيمة، نص]. يعيد { root, get, set }. */
function chips(options, { value = '', onchange } = {}) {
  let current = value;
  const root = el('div', { className: 'opts', role: 'radiogroup' });
  const paint = () =>
    root.querySelectorAll('.opt').forEach((b) => {
      const on = b.dataset.v === current;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
    });
  const set = (v) => {
    current = v;
    paint();
    if (onchange) onchange(v);
  };
  root.append(
    ...options.map((o) => {
      const [v, text] = Array.isArray(o) ? o : [o, o];
      const b = btn('opt', text, () => set(v), { role: 'radio' });
      b.dataset.v = v;
      return b;
    }),
  );
  paint();
  return { root, get: () => current, set };
}

/** مثل chips لكن يسمح باختيار أكثر من خيار (كل نقرة تبدّل الخيار). get() ترجع المختار بترتيب الخيارات. */
function multiChips(options, { value = [], onchange } = {}) {
  const chosen = new Set(value);
  const root = el('div', { className: 'opts', role: 'group' });
  const paint = () =>
    root.querySelectorAll('.opt').forEach((b) => {
      const on = chosen.has(b.dataset.v);
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
    });
  const get = () => options.filter((o) => chosen.has(o));
  const toggle = (v) => {
    if (chosen.has(v)) chosen.delete(v); else chosen.add(v);
    paint();
    if (onchange) onchange(get());
  };
  root.append(...options.map((o) => {
    const b = btn('opt', o, () => toggle(o), { role: 'checkbox' });
    b.dataset.v = o;
    return b;
  }));
  paint();
  return { root, get, set: (list) => { chosen.clear(); list.forEach((v) => chosen.add(v)); paint(); } };
}

/** عدّاد − [رقم] + حول حقل رقمي موجود. */
function stepper(input, min, max) {
  input.classList.add('st-in');
  const bump = (delta) => {
    const n = Number(input.value);
    input.value = input.value === '' || !Number.isFinite(n) ? min : Math.min(max, Math.max(min, n + delta));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  return el('div', { className: 'stepper' },
    btn('st-btn', '−', () => bump(-1), { 'aria-label': 'إنقاص' }),
    input,
    btn('st-btn', '+', () => bump(1), { 'aria-label': 'زيادة' }));
}

/** حقل مع وحدة بعده (مثل سم). */
const suffix = (input, unit) => el('span', { className: 'sfx' }, input, el('em', { textContent: unit }));

/** مجموعة بعنوان وتلميح اختياري. */
const grp = (title, body, hint) =>
  el('div', { className: 'grp' }, el('div', { className: 'grp-t', textContent: title }), body, hint ? el('div', { className: 'grp-h', textContent: hint }) : '');

export {lab, sel, btn, chips, multiChips, stepper, suffix, grp};
