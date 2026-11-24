// عناصر واجهة مشتركة بين شاشات قسم المصروفات.
import { el } from '../../core/dom.js';
import { workshopName } from '../../domain/expenses.js';
import { navigate } from '../../shell/router.js';

export const lab = (text, input) => el('label', { className: 'f' }, text + ' ', input);
export const kpi = (title, value) => el('div', { className: 'card kpi' },
  el('span', { textContent: title }), el('b', { textContent: value }));
const cell = (c) => (c instanceof Node ? el('td', {}, c) : el('td', { textContent: String(c) }));
export const table = (heads, rows) => el('table', {}, el('thead', {}, el('tr', {}, ...heads.map((h) => el('th', { textContent: h })))),
  el('tbody', {}, ...rows.map((r) => el('tr', {}, ...r.map(cell)))));
export const chip = (id) => el('span', { className: `chip w-${id || 'none'}`, textContent: workshopName(id) });

/** الانتقال لشهر: يغيّر الرابط، أو يعيد الرسم إن كنا فيه أصلاً. */
export function goTo(ym) {
  const hash = `#/expenses?m=${ym}`;
  if (location.hash === hash) navigate(); else location.hash = hash;
}
