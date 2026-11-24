import { el } from '../../../core/dom.js';
import { setKV } from '../../../infrastructure/db/store.js';
import { lab } from '../../../ui/controls.js';
import { DEFAULT_CLAUSE, getLayout, sheet, templateArea } from '../../invoices/sheet.js';
import { cropEditor, cm, toMm } from '../cropEditor.js';
import { sampleInvoiceData } from '../samplePrintData.js';
import { settingsCard, actionButton } from './card.js';

const MARGIN_KEYS = ['top', 'bottom', 'left', 'right', 'ft', 'fb', 'fl', 'fr'];
const MAX_MARGIN_MM = 200;
const MARGIN_HINT = 'اكتب 0 لإزالة الهامش تماماً. '
  + 'ملاحظة: بعض الطابعات تقصّ نحو 0.4 سم من الحافة مهما كانت الإعدادات.';

const numberField = (mm) => el('input', { type: 'number', min: 0, max: 20, step: 0.1, value: cm(mm) });

/** يقرأ النموذج ويتحقق: الهوامش بالمليمتر الصحيح بين 0 و200، ومنطقة الطباعة لا تقل عن 4 سم. */
function readLayout(form) {
  const layout = { mode: form.mode.value, totals: form.totals.checked, payments: form.payments.checked };
  for (const key of MARGIN_KEYS) layout[key] = toMm(form[key].value);
  for (const key of MARGIN_KEYS) {
    const valid = Number.isInteger(layout[key]) && layout[key] >= 0 && layout[key] <= MAX_MARGIN_MM;
    if (!valid) throw new Error('الهوامش بالسنتيمتر: من 0 إلى 20 (بدقة 0.1 سم)');
  }
  if (layout.left + layout.right > 170 || layout.top + layout.bottom > 257) {
    throw new Error('منطقة الطباعة صغيرة جداً (الحد الأدنى 4 سم عرضاً وارتفاعاً)');
  }
  return layout;
}

function buildForm(layout) {
  const mode = el('select', {},
    el('option', { value: 'letterhead', textContent: 'ورق مطبوع مسبقاً (الجدول فقط)' }),
    el('option', { value: 'full', textContent: 'فاتورة كاملة' }));
  mode.value = layout.mode;
  const checkbox = (on) => el('input', { type: 'checkbox', checked: !!on });
  const form = { mode, totals: checkbox(layout.totals), payments: checkbox(layout.payments) };
  for (const key of MARGIN_KEYS) form[key] = numberField(layout[key]);
  return form;
}

/** طباعة ورقة تجريبية بالهوامش الحالية عبر حاوية مؤقتة تُفرَّغ بعد الطباعة. */
function printTestPage(layout, holder) {
  holder.replaceChildren(sheet(sampleInvoiceData(), DEFAULT_CLAUSE, { ...layout, mode: 'letterhead' }));
  document.body.classList.add('pt');
  addEventListener('afterprint', () => { document.body.classList.remove('pt'); holder.replaceChildren(); }, { once: true });
  setTimeout(() => print(), 50);
}

export async function printLayoutSection({ notice }) {
  const layout = await getLayout();
  const form = buildForm(layout);
  const holder = el('div', { className: 'pt-holder' });
  const crop = cropEditor({ top: layout.top, bottom: layout.bottom, left: layout.left, right: layout.right }, (m) => {
    for (const side of ['top', 'bottom', 'left', 'right']) form[side].value = cm(m[side]);
  });
  for (const side of ['top', 'bottom', 'left', 'right']) {
    form[side].oninput = () => crop.set(Object.fromEntries(['top', 'bottom', 'left', 'right'].map((k) => [k, toMm(form[k].value) || 0])));
  }
  const attempt = (action) => () => { notice.clearError(); try { action(); } catch (error) { notice.fail(error.message); } };
  const save = actionButton('حفظ', async () => {
    notice.clearError();
    try {
      await setKV('settings', 'printLayout', readLayout(form));
      notice.done('تم حفظ إعدادات الطباعة');
    } catch (error) { notice.fail(error.message); }
  });
  const fit = actionButton('ضبط حسب القالب', attempt(() => {
    const area = templateArea();
    for (const side of Object.keys(area)) form[side].value = cm(area[side]);
    crop.set(area);
    notice.done('ضُبطت منطقة الطباعة على المساحة البيضاء بين الترويسة والتذييل، اضغط «حفظ» لتثبيتها');
  }), { light: true });
  const test = actionButton('طباعة صفحة اختبار', attempt(() => printTestPage(readLayout(form), holder)), { light: true });

  const card = settingsCard('ورق الفواتير والطباعة',
    el('div', { className: 'crop-wrap' }, crop.root, el('div', { className: 'crop-fields' },
      lab('الهامش العلوي (سم)', form.top), lab('الهامش السفلي (سم)', form.bottom), lab('الهامش الأيسر (سم)', form.left),
      lab('الهامش الأيمن (سم)', form.right), lab('وضع الطباعة الافتراضي', form.mode))),
    el('h4', { textContent: 'هوامش «فاتورة كاملة» (الهامش الأبيض حول الصفحة)' }),
    el('p', { className: 'hint', textContent: MARGIN_HINT }),
    el('div', { className: 'row' },
      lab('أعلى (سم)', form.ft), lab('أسفل (سم)', form.fb), lab('يسار (سم)', form.fl), lab('يمين (سم)', form.fr)),
    el('label', {}, form.totals, ' طباعة الإجمالي والمدفوعات والمتبقي'), el('label', {}, form.payments, ' طباعة سجل الدفعات'),
    el('div', { className: 'actions' }, save, fit, test));
  return [card, holder];
}
