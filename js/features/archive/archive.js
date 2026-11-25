import {el} from '../../core/dom.js';
import {sheet, getLayout} from '../invoices/sheet.js';
import {pdfFromJpegs} from '../../infrastructure/pdf.js';
import {loadHandle, writeFileTo, safeName, customerFolderName} from '../../infrastructure/backup.js';
import {LOGO_DATA} from '../../infrastructure/assets/logoData.js';

const W = 794, PH = 1123, S = 2; // A4 عند 96 بكسل/بوصة، وتكبير ×2 للوضوح
const PROPS = ['display', 'position', 'box-sizing', 'width', 'height', 'min-width', 'min-height', 'max-width', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'border-top', 'border-right', 'border-bottom', 'border-left', 'border-radius', 'border-collapse', 'border-spacing', 'table-layout', 'vertical-align', 'color', 'background-color', 'background-image', 'background-size', 'opacity',
  'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant-numeric', 'line-height', 'letter-spacing', 'text-align', 'direction', 'unicode-bidi', 'white-space', 'overflow-wrap', 'word-break', 'overflow',
  'left', 'top', 'right', 'bottom', 'z-index', 'transform', 'transform-origin', 'background-position', 'background-repeat', 'text-overflow', 'text-decoration', 'word-spacing', 'border-top-left-radius', 'border-top-right-radius', 'border-bottom-left-radius', 'border-bottom-right-radius', 'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis', 'align-items', 'align-self', 'justify-content', 'gap', 'object-fit', 'clip-path', 'caption-side'];
function inlineStyles(src, dst) {
  const cs = getComputedStyle(src); let css = ''; for (const p of PROPS) css += `${p}:${cs.getPropertyValue(p)};`; dst.setAttribute('style', css);
  for (let i = 0; i < src.children.length; i++) inlineStyles(src.children[i], dst.children[i]);
}
/** مجلد النسخ المحدد في الإعدادات إن كان الإذن متاحاً (يُطلب الإذن أثناء نقرة المستخدم). */
async function getBackupFolder(ask) {
  try { const h = await loadHandle(); if (!h) return null; const o = { mode: 'readwrite' }; if ((await h.queryPermission(o)) === 'granted') return h; if (ask && (await h.requestPermission(o)) === 'granted') return h; } catch {}
  return null;
}
/** يعرض الفاتورة الكاملة خارج الشاشة ويحوّلها إلى صفحات JPEG (A4). */
async function renderPages(data, clause) {
  const node = sheet(data, clause, { ...(await getLayout()), mode: 'full', noZoom: true }); node.classList.add('pdf'); const k = Number(node.dataset.fitScale || 1);
  const host = el('div', { style: `position:fixed;left:-12000px;top:0;width:${W}px;background:#fff` }, node); document.body.append(host);
  try {
    await new Promise(r => setTimeout(r, 60));
    const nat = node.offsetHeight, pages = k < 1 ? 1 : Math.max(1, Math.ceil(nat / PH)), H = k < 1 ? Math.max(nat, PH) : pages * PH; node.style.minHeight = H + 'px';
    const clone = node.cloneNode(true); inlineStyles(node, clone);
    clone.querySelectorAll('img.logo').forEach(i => { if (LOGO_DATA) i.setAttribute('src', LOGO_DATA); else i.remove(); });
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><foreignObject x="0" y="0" width="${W}" height="${H}">${new XMLSerializer().serializeToString(clone)}</foreignObject></svg>`;
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('تعذّر تحويل الفاتورة إلى صورة')); i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
    const big = document.createElement('canvas'); big.width = W * S; big.height = H * S; const g = big.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, big.width, big.height); g.drawImage(img, 0, 0, big.width, big.height);
    const out = [];
    for (let p = 0; p < pages; p++) {
      const c = document.createElement('canvas'); c.width = W * S; c.height = PH * S; const cg = c.getContext('2d'); cg.fillStyle = '#fff'; cg.fillRect(0, 0, c.width, c.height);
      if (k < 1) { const sc = PH / H, dw = big.width * sc; cg.drawImage(big, 0, 0, big.width, big.height, (c.width - dw) / 2, 0, dw, c.height); } // لم يكفِ أقصى ضغط: تصغير الصفحة كلها لتتسع في ورقة واحدة
      else cg.drawImage(big, 0, p * PH * S, W * S, PH * S, 0, 0, W * S, PH * S);
      const blob = await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('تعذّر إنشاء الصورة')), 'image/jpeg', 0.92));
      out.push({ data: new Uint8Array(await blob.arrayBuffer()), w: c.width, h: c.height });
    }
    return out;
  } finally { host.remove(); }
}
/** نسخة PDF من الفاتورة الكاملة باسم العميل: في مجلد النسخ إن أمكن، وإلا تنزيل مباشر. */
async function savePdfCopy(data, clause, folder) {
  const bytes = pdfFromJpegs(await renderPages(data, clause)), c = data.customer || {};
  const name = `${safeName(c.name || 'عميل')} - ${data.invoice.invoiceDate} - ${String(data.invoice.id || '').slice(0, 8)}.pdf`;
  if (folder) { const path = `العملاء/${customerFolderName(c)}/فواتير PDF/${name}`; try { await writeFileTo(folder, path, bytes); return { where: 'folder', path, name }; } catch {} }
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 8000);
  return { where: 'download', name };
}
/** يحفظ ملف PDF جاهزاً باسم محدد: في مجلد النسخ (مجلد العميل) إن أمكن وإلا تنزيل مباشر. */
async function savePdfBytes(bytes, name, customer, folder) {
  if (folder) { const path = `العملاء/${customerFolderName(customer || {})}/فواتير PDF/${name}`; try { await writeFileTo(folder, path, bytes); return { where: 'folder', path, name }; } catch {} }
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 8000);
  return { where: 'download', name };
}
/** الطباعة بعنوان صفحة = اسم العميل، فيقترحه المتصفح اسماً لملف «حفظ كـ PDF» أيضاً. */
function printAs(title) { const old = document.title; document.title = title; addEventListener('afterprint', () => { document.title = old; }, { once: true }); print(); }

export {inlineStyles, getBackupFolder, savePdfCopy, savePdfBytes, printAs};
