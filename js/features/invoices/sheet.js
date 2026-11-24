import { el } from '../../core/dom.js';
import { invoiceTotals } from '../../domain/accounting.js';
import { formatEGP, formatDate } from '../../core/formatters.js';
import { getKV, setKV } from '../../infrastructure/db/store.js';
import { DEFAULT_DESIGN, getDesign } from './sheetDesign.js';
import { buildFoot, buildHead, buildWatermark } from './sheetFrame.js';
export const DEFAULT_CLAUSE = 'اذا حدث ارتفاع في الاسعار خارج عن ارادتنا من تعويم او حروب او ازمات داخل البلد خلال فتره التعاقد يتم احتساب نسبه الزياده علي العقد وذلك بعد ال50% المقدم واذا تم دفع ال 75% يتحمل المصنع الزيادات.';
// إعدادات الورق المطبوع مسبقاً: الأبعاد بالمليمتر (ارتفاع الترويسة/التذييل المطبوعين على الورقة + الهامش الجانبي)
// مقاس الترويسة والتذييل ثابت بالمليمتر ولا يتأثر بعدد البنود: الورق الجاهز المطبوع بالألوان يحمل نفس المقاس بالضبط
export const HEAD_MM = 56, FOOT_MM = 54, EDGE_MM = 3;
const PAGE_MM = 297, SHEET_MM = 296, GAP_MM = 1; // ارتفاع الورقة، وارتفاع الفاتورة الكاملة، وفاصل أمان 1 مم عن الترويسة والتذييل
/** منطقة الطباعة (مم) = المساحة البيضاء بين الترويسة والتذييل في القالب الفارغ. */
export const templateArea = () => ({
  top: HEAD_MM + EDGE_MM + GAP_MM,
  bottom: PAGE_MM - (SHEET_MM - EDGE_MM - FOOT_MM) + GAP_MM,
  left: EDGE_MM, right: EDGE_MM,
});
/** الهوامش الافتراضية (مم): علوي 5 سم، سفلي 5 سم، يسار ويمين 0.5 سم. */
export const DEFAULT_MARGINS = { top: 50, bottom: 50, left: 5, right: 5 };
export const DEFAULT_LAYOUT = { mode: 'letterhead', ...DEFAULT_MARGINS, totals: true, payments: true, ft: EDGE_MM, fb: EDGE_MM, fl: EDGE_MM, fr: EDGE_MM };
const OPTS_VERSION = 1; // إصدارات ضبط تلقائي لمرة واحدة (انظر getLayout)
export async function getLayout() {
  const s = await getKV('settings', 'printLayout', {}), saved = { ...s }, o = { ...DEFAULT_LAYOUT, ...s };
  if (s.side !== undefined) { if (s.left === undefined) o.left = s.side; if (s.right === undefined) o.right = s.side; }
  delete o.side; delete saved.side;
  const once = async (key, version, apply) => {
    if (await getKV('settings', key, 0) === version) return;
    apply(o); apply(saved); await setKV('settings', key, version); await setKV('settings', 'printLayout', saved);
  };
  // طباعة الإجمالي/المدفوعات/المتبقي وسجل الدفعات مفعّلتان دائماً افتراضياً
  await once('printLayoutOpts', OPTS_VERSION, x => Object.assign(x, { totals: true, payments: true }));
  o.design = await getDesign();
  return o;
}

const td = (t, c = '') => el('td', { textContent: t, className: c });
const tds = (t, rs, c = '') => el('td', { textContent: t, rowSpan: rs, className: c });
const headerRow = showPrice => el('tr', {}, ...['م', 'الصنف', 'المواصفات والمشتملات', 'المقاس', 'الكمية', ...(showPrice ? ['السعر'] : [])].map(x => el('th', { textContent: x })));
const colgroup = showPrice => el('colgroup', {}, ...(showPrice ? [7, 12, 41, 16, 8, 16] : [7, 13, 48, 20, 12]).map(w => el('col', { style: `width:${w}%` })));
const showPriceOf = d => d.items.some(i => i.unitPricePiastres > 0);

// كل مشتمل في سطر مستقل ومقاسه في عمود المقاس أمامه؛ الفواتير القديمة بلا lines تُعرض كما كانت.
function itemRows(d, showPrice) {
  const rows = [];
  d.items.forEach((i, n) => {
    const lines = i.lines && i.lines.length ? i.lines.map(l => ({ ...l })) : [{ text: i.description, size: i.sizeText || '—' }];
    if (i.notes) lines.push({ text: `ملاحظات: ${i.notes}`, size: '' });
    const rs = lines.length;
    lines.forEach((ln, k) => {
      const tr = el('tr', { className: k === rs - 1 ? 'last' : '' });
      if (k === 0) tr.append(tds(n + 1, rs, 'mid c'), tds(i.category, rs, 'mid'));
      tr.append(td(ln.text, 'pre'), td(ln.size, 'sz'));
      if (k === 0) { tr.append(tds(i.qty, rs, 'mid c')); if (showPrice) tr.append(tds(i.unitPricePiastres > 0 ? formatEGP(i.qty * i.unitPricePiastres) : '—', rs, 'mid c')); }
      rows.push(tr);
    });
  });
  return rows;
}
const payTable = pays => el('div', {}, el('h3', { textContent: 'سجل الدفعات المسددة بالتاريخ' }), el('table', { className: 'sh-pay' }, el('thead', {}, el('tr', {}, ...['التاريخ', 'المبلغ', 'طريقة الدفع', 'سند القبض', 'ملاحظات'].map(x => el('th', { textContent: x })))),
  el('tbody', {}, ...pays.map(p => el('tr', {}, td(formatDate(p.paidAt)), td(formatEGP(p.amountPiastres)), td(p.method), td(p.receiptNo || '—'), td(p.notes || '—'))))));
const sumTable = t => {
  const sum = [['الإجمالي', t.net, 'net'], ['المدفوعات', t.paid, 'paid'], ['المتبقي', t.remaining, 'due']];
  if (t.credit) sum.push(['رصيد دائن للعميل (زيادة عن المطلوب)', t.credit, 'credit']);
  return el('table', { className: 'sh-sum' }, el('tbody', {}, ...sum.map(([k, v, c]) => el('tr', { className: c }, td(k), td(formatEGP(v), 'num')))));
};

/** وضع الورق المطبوع مسبقاً: يُطبع الجدول فقط. صفّا فراغ في thead/tfoot يحجزان مكان الترويسة والتذييل المطبوعين ويتكرران في كل صفحة. */
function letterhead(d, o) {
  const showPrice = showPriceOf(d), cols = showPrice ? 6 : 5, pays = d.payments.filter(p => p.status === 'active');
  const sp = h => el('tr', { className: 'sp' }, el('td', { colSpan: cols, style: `height:${Number(h) || 0}mm` }));
  const full = n => el('tr', { className: 'xr' }, el('td', { colSpan: cols }, n));
  const body = [];
  // وضع «عرض الفاتورة» = الجدول فقط: مستطيل (الاسم/التاريخ/الهاتف) موجود أصلاً في القالب المطبوع مسبقاً فلا يُعرض هنا
  body.push(...itemRows(d, showPrice));
  if (o.payments && pays.length) body.push(full(payTable(pays)));
  if (o.totals) body.push(full(sumTable(invoiceTotals(d.items, d.payments, d.invoice))));
  const table = el('table', { className: 'sh-items lh-table' }, colgroup(showPrice), el('thead', {}, sp(o.top), headerRow(showPrice)), el('tfoot', {}, sp(o.bottom)), el('tbody', {}, ...body));
  return el('div', { className: 'sheet lh', style: `padding:0 ${Number(o.right ?? o.side) || 0}mm 0 ${Number(o.left ?? o.side) || 0}mm` }, table);
}

/** الفاتورة الكاملة (بلا ضغط تلقائي). opts.blank = قالب فارغ: الترويسة والمستطيل والتذييل فقط بلا جدول ولا بيانات. */
function buildFull(d, clause, o = {}) {
  const g = o.design || DEFAULT_DESIGN, blank = !!o.blank, body = el('div', { className: 'sh-body' });
  if (!blank) {
    const t = invoiceTotals(d.items, d.payments, d.invoice), showPrice = showPriceOf(d);
    const pays = d.payments.filter(p => p.status === 'active');
    body.append(el('table', { className: 'sh-items' }, colgroup(showPrice),
      el('thead', {}, headerRow(showPrice)), el('tbody', {}, ...itemRows(d, showPrice))));
    if (pays.length) body.append(payTable(pays));
    body.append(sumTable(t));
  }
  // الهوامش (من الإعدادات) بالمليمتر، والترويسة والتذييل بمقاس ثابت، واللونان من التصميم
  const mm = x => (Number.isFinite(Number(x)) ? Number(x) : EDGE_MM) + 'mm';
  const pad = `padding:${mm(o.ft)} ${mm(o.fr)} ${mm(o.fb)} ${mm(o.fl)};--walnut:${g.walnut};--gold:${g.gold}`;
  return el('div', { className: 'sheet' + (blank ? ' blank' : ''), style: pad },
    buildHead(g, d, blank, HEAD_MM), body, buildFoot(g, clause, FOOT_MM));
}

/** ترقيم الصفحات «صفحة X من N» (تجريبي، اختياري من الإعدادات): يحتاج Chrome/Edge حديثاً. */
export function applyPageNumbers(on) {
  document.body.classList.toggle('pn', !!on);
  let st = document.getElementById('pn-style');
  if (on && !st) { st = Object.assign(document.createElement('style'), { id: 'pn-style', textContent: '@page{size:A4 portrait;margin:0 0 11mm;@bottom-center{content:"صفحة " counter(page) " من " counter(pages);font:600 9pt Tahoma,Arial,sans-serif;color:#817466}}' }); document.head.append(st); }
  if (!on && st) st.remove();
}

// ===== ضغط تلقائي: كل المحتوى في صفحة A4 واحدة =====
// مستويات fit-1..fit-5 في الـ CSS تقلّص المسافات ثم الخطوط تدريجياً؛ نختار أقل مستوى يكفي.
const FIT_MAX = 5, FIT_MAX_LH = 7; // الورق الجاهز يتحمل ضغطاً أكبر لأن الترويسة والتذييل خارج الجدول
const setFit = (n, l) => { for (let i = 1; i <= FIT_MAX_LH; i++) n.classList.remove('fit-' + i); if (l) n.classList.add('fit-' + l); };
/** يقيس خارج الشاشة بعرض A4 (794px). حد الارتفاع ≈ 293.7مم (أو أقل مع ترقيم الصفحات) لترك هامش أمان. */
/** يختار أقل مستوى ضغط تتسع عنده البنود في صفحة واحدة. الورق الجاهز: إن لم يكفِ أقصى ضغط يبقى الحجم المقروء وتمتد الصفحات. */
function measureFit(make, lh) {
  const node = make(); node.classList.add('measuring'); if (!lh) node.classList.add('pdf'); node.style.minHeight = '0';
  const host = el('div', { style: 'position:fixed;left:-12000px;top:0;width:794px;visibility:hidden' }, node); document.body.append(host);
  const limit = document.body.classList.contains('pn') ? 1068 : 1110, max = lh ? FIT_MAX_LH : FIT_MAX;
  try {
    for (let l = 0; l <= max; l++) { setFit(node, l); if (node.offsetHeight <= limit) return { level: l, scale: 1 }; }
    // الترويسة والتذييل بمقاس ثابت: لا تصغير للورقة كلها أبداً؛ إن زادت البنود عن أقصى ضغط تمتد الصفحات
    return lh ? { level: FIT_MAX, scale: 1, overflow: true } : { level: FIT_MAX, scale: 1 };
  } finally { host.remove(); }
}

const OVERFLOW_NOTE = 'البنود كثيرة جداً: لا تتسع في صفحة واحدة حتى بأصغر خط مقروء، فستُطبع على أكثر من صفحة.';

export function sheet(d, clause = DEFAULT_CLAUSE, opts = {}) {
  const lh = opts.mode === 'letterhead', wm = (opts.design || DEFAULT_DESIGN).wm;
  // العلامة المائية: في منطقة الجدول؛ القالب الفارغ لا يحملها (إلا في المعاينة) لأنها تُطبع مع الجدول
  const addWm = node => {
    if (!wm.on || (opts.blank && !opts.previewWm)) return node;
    node.classList.add('has-wm');
    node.append(buildWatermark(wm, lh && !opts.blank ? opts : templateArea()));
    return node;
  };
  if (opts.blank) return addWm(buildFull(d, clause, opts));
  const make = () => lh ? letterhead(d, opts) : buildFull(d, clause, opts), node = make();
  if (typeof document === 'undefined') return node;
  const f = measureFit(make, lh); setFit(node, f.level);
  if (f.overflow) node.prepend(el('div', { className: 'scr-only fit-warn', textContent: OVERFLOW_NOTE }));
  if (f.scale < 1) { node.dataset.fitScale = String(f.scale); if (!opts.noZoom) node.style.zoom = f.scale; }
  return addWm(node);
}
