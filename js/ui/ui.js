import { el } from '../core/dom.js';
let layer = null, prevFocus = null;
const onKey = e => { if (e.key === 'Escape') closeModal(); };
export const isModalOpen = () => !!layer;
export function closeModal() { if (!layer) return; layer.remove(); layer = null; document.removeEventListener('keydown', onKey); prevFocus?.focus?.(); }
/** نافذة منبثقة: Esc أو النقر خارجها يغلقها. */
export function openModal(title, content, { wide = false } = {}) {
  closeModal(); prevFocus = document.activeElement;
  const box = el('div', { className: 'modal' + (wide ? ' wide' : '') }, el('div', { className: 'modal-head' }, el('h3', { textContent: title }), el('button', { className: 'x', type: 'button', textContent: '×', title: 'إغلاق (Esc)', onclick: closeModal })), content);
  layer = el('div', { className: 'modal-layer no-print', onmousedown: e => { if (e.target === layer) closeModal(); } }, box);
  document.body.append(layer); document.addEventListener('keydown', onKey); return box;
}
export function toast(msg) {
  const t = el('div', { className: 'toast no-print', textContent: msg }); document.body.append(t);
  setTimeout(() => t.classList.add('show'), 10); setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3800);
}
export function icon(d) { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'ic'); const p = document.createElementNS(s.namespaceURI, 'path'); p.setAttribute('d', d); s.append(p); return s; }
