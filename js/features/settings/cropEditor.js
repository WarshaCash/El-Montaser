import { el } from '../../core/dom.js';
export const PAGE_W = 210, PAGE_H = 297, MIN = 40;
/** الحفظ الداخلي بالمليمتر (أعداد صحيحة) والعرض بالسنتيمتر: 21 × 29.7 سم */
export const cm = mm => Number((mm / 10).toFixed(1));
export const toMm = v => Math.round(Number(v) * 10);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const boxFromMargins = m => ({ x: m.left, y: m.top, w: PAGE_W - m.left - m.right, h: PAGE_H - m.top - m.bottom });
export const marginsOf = b => ({ top: b.y, bottom: PAGE_H - b.y - b.h, left: b.x, right: PAGE_W - b.x - b.w });
export function fitBox(b) { const w = clamp(b.w, MIN, PAGE_W), h = clamp(b.h, MIN, PAGE_H); return { x: clamp(b.x, 0, PAGE_W - w), y: clamp(b.y, 0, PAGE_H - h), w, h }; }
/** نقية: تحريك أو تغيير حجم مربع القص بالمليمتر مع بقائه داخل الورقة وبحد أدنى للحجم. mode: move | n s e w ne nw se sw */
export function resizeBox(s, mode, dx, dy) {
  if (mode === 'move') return { x: clamp(s.x + dx, 0, PAGE_W - s.w), y: clamp(s.y + dy, 0, PAGE_H - s.h), w: s.w, h: s.h };
  let x1 = s.x, y1 = s.y, x2 = s.x + s.w, y2 = s.y + s.h;
  if (mode.includes('w')) x1 = clamp(s.x + dx, 0, x2 - MIN);
  if (mode.includes('e')) x2 = clamp(s.x + s.w + dx, x1 + MIN, PAGE_W);
  if (mode.includes('n')) y1 = clamp(s.y + dy, 0, y2 - MIN);
  if (mode.includes('s')) y2 = clamp(s.y + s.h + dy, y1 + MIN, PAGE_H);
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/** محرر قص: ورقة A4 مصغّرة (1.5 بكسل لكل مم) وفيها مستطيل منطقة الطباعة يُسحب ويُحجَّم. يعيد الهوامش بالمليمتر. */
export function cropEditor(init, onChange) {
  const PX = 1.5; let b = fitBox(boxFromMargins(init));
  const dim = el('span', { className: 'crop-dim' }), handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map(m => el('span', { className: 'crop-h h-' + m }));
  const box = el('div', { className: 'crop-box' }, dim, ...handles);
  const page = el('div', { className: 'crop-page', style: `width:${PAGE_W * PX}px;height:${PAGE_H * PX}px` }, box);
  const draw = () => { box.style.left = b.x * PX + 'px'; box.style.top = b.y * PX + 'px'; box.style.width = b.w * PX + 'px'; box.style.height = b.h * PX + 'px'; dim.textContent = `${cm(b.w)} × ${cm(b.h)} سم`; };
  const bind = (node, mode) => {
    node.onpointerdown = e => {
      e.preventDefault(); e.stopPropagation(); node.setPointerCapture(e.pointerId);
      const sx = e.clientX, sy = e.clientY, start = { ...b };
      node.onpointermove = ev => { b = resizeBox(start, mode, Math.round((ev.clientX - sx) / PX), Math.round((ev.clientY - sy) / PX)); draw(); onChange(marginsOf(b)); };
      node.onpointerup = node.onpointercancel = () => { node.onpointermove = node.onpointerup = node.onpointercancel = null; };
    };
  };
  bind(box, 'move'); handles.forEach((h, i) => bind(h, ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'][i]));
  draw();
  const cap = el('div', { className: 'crop-cap', textContent: `A4 — ${cm(PAGE_W)} × ${cm(PAGE_H)} سم` });
  return { root: el('div', { className: 'crop-col' }, page, cap), set: m => { b = fitBox(boxFromMargins(m)); draw(); } };
}
