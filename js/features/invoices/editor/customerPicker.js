// اختيار العميل في شاشة الفاتورة: بحث، قائمة، وإدخال عميل جديد/يدوي مع كشف التكرار.
import { el } from '../../../core/dom.js';
import { normText, normalizePhone, toLatinDigits } from '../../../core/validators.js';
import { lab } from '../../../ui/controls.js';

const MANUAL = '__manual__';
const digitsOf = (text) => toLatinDigits(text).replace(/\D/g, '');

/**
 * options: { customers, editing, paymentsLocked, preselectId, onChange }
 *  - editing: فاتورة قائمة (لا إضافة عميل جديد)، وpaymentsLocked يمنع تغيير العميل بعد وجود دفعات
 * يعيد { fields, manualBox, current(), resolve() }.
 */
export function createCustomerPicker({ customers, editing, paymentsLocked, preselectId, onChange }) {
  const manualAllowed = !editing;

  const optionsFor = (query) => {
    const text = normText(query);
    const digits = digitsOf(query);
    const manual = manualAllowed ? [el('option', { value: MANUAL, textContent: '＋ عميل جديد…' })] : [];
    const found = customers
      .filter((c) => !text || normText(c.name).includes(text) || (digits && (c.phone || '').includes(digits)))
      .map((c) => el('option', { value: c.id, textContent: `${c.name} ${c.phone || ''}` }));
    return [...found, ...manual];
  };

  const select = el('select', {}, ...optionsFor(''));
  const find = el('input', { type: 'search', placeholder: 'اكتب الاسم أو الهاتف…' });
  const nameInput = el('input', { placeholder: 'اسم العميل' });
  const phoneInput = el('input', { placeholder: '11 رقماً', inputMode: 'numeric', maxLength: 11 });
  const hint = 'سيُضاف هذا العميل تلقائياً إلى شاشة «العملاء» عند حفظ الفاتورة.';
  const manualBox = el('div', { className: 'new-cust' },
    el('div', { className: 'row' },
      lab('اسم العميل الجديد', nameInput),
      lab('رقم الهاتف (11 رقماً)', phoneInput)),
    el('p', { className: 'hint', textContent: hint }));

  if (preselectId && customers.some((c) => c.id === preselectId)) select.value = preselectId;
  if (editing) {
    select.value = editing.customerId;
    if (paymentsLocked) { select.disabled = true; select.title = 'لا يمكن تغيير العميل بعد تسجيل دفعات'; }
  }

  let lastExisting = select.value;
  const toggle = el('button', { className: 'btn light cust-toggle', type: 'button' });
  const sync = () => {
    const manual = select.value === MANUAL;
    manualBox.hidden = !manual;
    toggle.textContent = manual ? (customers.length ? '× اختيار عميل موجود' : '') : '＋ عميل جديد';
    toggle.hidden = !manualAllowed || (manual && !customers.length);
  };
  const firstExisting = () => (select.options[0]?.value === MANUAL ? (select.options[1]?.value ?? MANUAL) : select.options[0].value);

  toggle.onclick = () => {
    if (select.value === MANUAL) {
      const canRestore = lastExisting !== MANUAL && [...select.options].some((o) => o.value === lastExisting);
      select.value = canRestore ? lastExisting : firstExisting();
    } else { lastExisting = select.value; select.value = MANUAL; }
    sync();
    onChange();
    if (select.value === MANUAL) nameInput.focus();
  };
  select.onchange = () => { if (select.value !== MANUAL) lastExisting = select.value; sync(); onChange(); };

  /** ما كُتب في البحث يُنقل لحقول العميل الجديد: 11 رقماً = هاتف، وإلا نص بلا أرقام = اسم. */
  const prefillFromSearch = () => {
    const text = find.value.trim();
    const digits = digitsOf(text);
    if (digits.length === 11) {
      if (!phoneInput.value) phoneInput.value = digits;
    } else if (text && !digits && !nameInput.value) {
      nameInput.value = text;
    }
  };
  find.oninput = () => {
    const keep = select.value;
    select.replaceChildren(...optionsFor(find.value));
    if ([...select.options].some((o) => o.value === keep)) select.value = keep;
    else select.selectedIndex = 0;
    sync();
    if (select.value === MANUAL) prefillFromSearch();
    onChange();
  };
  phoneInput.oninput = () => { phoneInput.value = digitsOf(phoneInput.value).slice(0, 11); onChange(); };
  nameInput.oninput = onChange;
  sync();

  const current = () => (select.value === MANUAL
    ? { name: nameInput.value.trim(), phone: phoneInput.value }
    : customers.find((c) => c.id === select.value));

  const duplicateOf = (name, phone) => {
    const byPhone = phone && customers.find((c) => c.phone === phone);
    const byName = customers.find((c) => normText(c.name) === normText(name));
    return { match: byPhone || byName, reason: byPhone ? 'رقم الهاتف' : 'الاسم' };
  };

  /** يحدد العميل عند الحفظ: { customerId } لعميل موجود أو { newCustomer } لعميل جديد (مع عرض عميل مطابق إن وُجد). */
  function resolve() {
    let customerId = select.value;
    let newCustomer = null;
    if (customerId === MANUAL) {
      const name = nameInput.value.trim();
      if (name.length < 2) throw new Error('اكتب اسم العميل');
      const phone = normalizePhone(phoneInput.value);
      const { match, reason } = duplicateOf(name, phone);
      const shown = match && `${match.name}${match.phone ? ' — ' + match.phone : ''}`;
      const question = match && `يوجد عميل محفوظ بنفس ${reason} «${shown}». هل تريد استخدامه؟\n(موافق = استخدامه، إلغاء = إنشاء عميل جديد)`;
      if (match && confirm(question)) customerId = match.id;
      else { customerId = null; newCustomer = { name, phone }; }
    }
    if (!customerId && !newCustomer) throw new Error('اختر العميل');
    return { customerId, newCustomer };
  }

  return { fields: [lab('بحث عن عميل', find), lab('العميل', select), toggle], manualBox, current, resolve };
}
