import { el } from '../../core/dom.js';
import { formatDate } from '../../core/formatters.js';
import { ICONS } from '../../infrastructure/assets/iconsData.js';
import { ICON_LABELS } from './sheetDesign.js';

/** الأجزاء الثابتة في الفاتورة: الترويسة + مستطيل (الاسم/التاريخ/الهاتف)، والتذييل. تصميمها من sheetDesign. */
const cf = (label, value) => el('span', { className: 'cf' }, el('small', { textContent: label }), el('b', { textContent: value }));

/** بيانات العميل والتاريخ: تظهر على الشاشة وفي PDF، ويُطبع المستطيل بعناوينه وقيمه فارغة (انظر CSS). blank = قالب فارغ. */
export const custStrip = (d, blank = false) => el('div', { className: 'sh-cust scr-only' },
  cf('اسم صاحب الفاتورة:', blank ? '' : d.customer?.name || ''),
  cf('التاريخ:', blank ? '' : formatDate(d.invoice.invoiceDate)),
  cf('الهاتف:', blank ? '' : d.customer?.phone || '—'));

export function buildHead(g, d, blank, heightMm) {
  const logo = el('img', { src: g.logo || 'assets/logo.webp', alt: '', className: 'logo' });
  logo.onerror = () => logo.replaceWith(el('div', { className: 'logo ph', textContent: 'الشعار' }));
  const text = el('div', { className: 'sh-txt' },
    el('h2', { textContent: g.name }),
    el('div', { className: 'sh-sub' }, el('i'), el('span', { textContent: g.sub }), el('i')),
    el('div', { className: 'sh-tag', textContent: g.tag }));
  return el('div', { className: 'sh-top', style: `height:${heightMm}mm` },
    el('div', { className: 'sh-head', style: `background-color:${g.walnut}` }, text, logo),
    el('div', { className: 'sh-gold' }), custStrip(d, blank));
}

export function buildFoot(g, clause, heightMm) {
  const icons = ICON_LABELS.filter(([key]) => g.icons[key])
    .map(([key, title]) => el('img', { src: ICONS[key] || '', alt: title, title, className: 'ico' }));
  const contact = el('span', { className: 'contact' },
    ...(icons.length ? [el('span', { className: 'ico-row' }, ...icons)] : []),
    ...(g.phone ? [el('span', { className: 'num', textContent: g.phone })] : []),
    ...(g.whatsapp ? [el('span', { className: 'num wa', textContent: g.whatsapp })] : []));
  const block = (label, extra = '') => el('span', { className: 'sh-blk' },
    el('span', { textContent: label }), el('span', { className: 'stamp ' + extra }));
  return el('div', { className: 'sh-foot', style: `height:${heightMm}mm` },
    el('p', { className: 'clause', textContent: clause }),
    el('div', { className: 'sh-row' }, block(g.signLabel, 'sigbox'), contact, block(g.admin ? `الإدارة : ${g.admin}` : '')));
}

/** علامة مائية في منتصف منطقة الجدول (هوامش area بالمليمتر من حواف الورقة)؛ تتكرر في كل صفحة عند الطباعة. */
export function buildWatermark(wm, area) {
  const img = el('img', { src: 'assets/watermark.webp', alt: '', style: `opacity:${wm.opacity / 100};max-width:${wm.size}%` });
  const box = `top:${area.top}mm;bottom:${area.bottom}mm;left:${area.left}mm;right:${area.right}mm`;
  return el('div', { className: 'wm', style: box }, img);
}
