import {el} from '../../../core/dom.js';
import {setKV} from '../../../infrastructure/db/store.js';
import {lab} from '../../../ui/controls.js';
import {getLayout, sheet} from '../../invoices/sheet.js';
import {clause} from '../../invoices/invoiceDefaults.js';
import {DEFAULT_DESIGN, ICON_LABELS, getDesign, isHex} from '../../invoices/sheetDesign.js';
import {settingsCard, actionButton} from './card.js';

const TEXT_FIELDS = [
  ['name', 'اسم المعرض (الترويسة)'], ['sub', 'السطر الفرعي'], ['tag', 'الشعار النصي'],
  ['signLabel', 'عنوان خانة العميل'], ['admin', 'اسم الإدارة'], ['phone', 'رقم التواصل أسفل الورقة'], ['whatsapp', 'رقم الواتساب أسفل الورقة'],
];
const LOGO_MAX_PX = 512;
const HINT = 'يُطبع القالب الفارغ بالترويسة ومستطيل (الاسم/التاريخ/الهاتف) والتذييل فقط، بمقاس ثابت. '
  + 'لطباعة عدد كبير اختر عدد النسخ من نافذة الطباعة. شرط الأسعار يُعدَّل من قسم «شرط الأسعار».';

/** يصغّر الشعار المرفوع إلى حد أقصى 512 بكسل ويحفظه كبيانات مضمّنة. */
const readLogo = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file), img = new Image();
  img.onload = () => {
    const k = Math.min(1, LOGO_MAX_PX / Math.max(img.width, img.height));
    const canvas = el('canvas', { width: Math.round(img.width * k), height: Math.round(img.height * k) });
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url); resolve(canvas.toDataURL('image/png'));
  };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('تعذّر قراءة صورة الشعار')); };
  img.src = url;
});

const blankData = () => ({ customer: {}, invoice: {}, items: [], payments: [] });

async function sheetDesignSection({ notice }) {
  const [layout, clauseText, saved] = await Promise.all([getLayout(), clause(), getDesign()]);
  const design = { ...saved, icons: { ...saved.icons }, wm: { ...saved.wm } };
  const holder = el('div', { className: 'pt-holder' });
  const preview = el('div', { className: 'sd-preview' });
  const build = (previewWm = false) => sheet(blankData(), clauseText, { ...layout, design, blank: true, previewWm });
  const refresh = () => preview.replaceChildren(build(true));

  const fields = TEXT_FIELDS.map(([key, label]) => {
    const input = el('input', { type: 'text', value: design[key] || '', className: 'wide' });
    input.oninput = () => { design[key] = input.value; refresh(); };
    return lab(label, input);
  });
  const color = (key, label) => {
    const input = el('input', { type: 'color', value: design[key] });
    input.oninput = () => { design[key] = input.value; refresh(); };
    return lab(label, input);
  };
  const logoInput = el('input', { type: 'file', accept: 'image/*' });
  logoInput.onchange = async () => {
    notice.clearError();
    try {
      if (logoInput.files[0]) { design.logo = await readLogo(logoInput.files[0]); refresh(); }
    } catch (error) { notice.fail(error.message); }
  };
  const resetLogo = actionButton('الشعار الافتراضي', () => { design.logo = ''; logoInput.value = ''; refresh(); }, { light: true });
  const iconBoxes = ICON_LABELS.map(([key, label]) => {
    const box = el('input', { type: 'checkbox', checked: !!design.icons[key] });
    box.onchange = () => { design.icons[key] = box.checked; refresh(); };
    return el('label', {}, box, ' ' + label);
  });

  const wmOn = el('input', { type: 'checkbox', checked: !!design.wm.on });
  wmOn.onchange = () => { design.wm.on = wmOn.checked; refresh(); };
  const slider = (key, label, min, max) => {
    const out = el('b', { textContent: design.wm[key] + '%' });
    const input = el('input', { type: 'range', min, max, step: 1, value: design.wm[key] });
    input.oninput = () => { design.wm[key] = Number(input.value); out.textContent = input.value + '%'; refresh(); };
    return lab(label, el('span', { className: 'row' }, input, out));
  };
  const wmRow = el('div', { className: 'row' }, el('label', {}, wmOn, ' طباعة العلامة المائية (شعار المعرض) في منتصف الجدول'),
    slider('opacity', 'الشفافية (أقل = أخف)', 2, 40), slider('size', 'الحجم', 30, 100));
  const save = actionButton('حفظ التصميم', async () => {
    notice.clearError();
    if (!isHex(design.walnut) || !isHex(design.gold)) return notice.fail('اللون غير صالح');
    await setKV('settings', 'sheetDesign', design);
    notice.done('تم حفظ تصميم الترويسة والتذييل');
  });
  const reset = actionButton('استعادة التصميم الأصلي', () => {
    Object.assign(design, structuredClone(DEFAULT_DESIGN));
    notice.done('تمت الاستعادة، اضغط «حفظ التصميم» لتثبيتها');
    const fresh = buildCard(); section.replaceWith(fresh); section = fresh; refresh();
  }, { light: true });
  const printBlank = actionButton('طباعة قالب فارغ (A4)', () => {
    holder.replaceChildren(build());
    document.body.classList.add('pt');
    addEventListener('afterprint', () => { document.body.classList.remove('pt'); holder.replaceChildren(); }, { once: true });
    setTimeout(() => print(), 50);
  });

  function buildCard() {
    return settingsCard('تصميم الترويسة والتذييل وقالب الورق الفارغ',
      el('p', { className: 'hint', textContent: HINT }),
      el('div', { className: 'row' }, ...fields),
      el('div', { className: 'row' }, color('walnut', 'لون الترويسة والجداول'), color('gold', 'اللون الذهبي'),
        lab('شعار الترويسة', logoInput), resetLogo),
      el('div', { className: 'row' }, ...iconBoxes), wmRow,
      el('div', { className: 'actions' }, save, printBlank, reset),
      el('h4', { textContent: 'معاينة القالب' }), preview);
  }
  let section = buildCard(); refresh();
  return [section, holder];
}

export {sheetDesignSection};
