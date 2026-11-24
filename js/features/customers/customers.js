import { getAll } from '../../infrastructure/db/store.js';
import { addCustomer, updateCustomer, deleteCustomer } from '../../infrastructure/repositories/customerRepository.js';
import { normalizePhone, phoneForUpdate, toLatinDigits, normText } from '../../core/validators.js';
import { el } from '../../core/dom.js';
import { openCollect } from '../quickAccess/quick.js';

export async function renderCustomers(v, params) {
  const name = el('input', { placeholder: 'اسم العميل', required: true });
  const phone = el('input', { placeholder: 'رقم الهاتف (11 رقماً)', inputMode: 'numeric', maxLength: 11, required: true });
  const title = el('h3', { textContent: 'إضافة عميل' });
  const save = el('button', { className: 'btn', type: 'submit', textContent: 'حفظ العميل' });
  const cancel = el('button', { className: 'btn danger', type: 'button', textContent: 'إلغاء التعديل', hidden: true });
  const err = el('div', { className: 'err' }), form = el('form', { className: 'row' }, name, phone, save, cancel);
  const search = el('input', { type: 'search', placeholder: 'بحث بالاسم أو الهاتف' }), info = el('p', { className: 'hint' });
  const body = el('tbody'), table = el('table', {}, el('thead', {}, el('tr', {}, el('th', { textContent: 'الاسم' }), el('th', { textContent: 'الهاتف' }), el('th', { textContent: 'إجراءات' }))), body);
  const empty = el('div', { className: 'empty', textContent: 'لا يوجد عملاء مطابقون.' });
  let all = await getAll('customers'), editing = null;

  const setMode = c => {
    editing = c; err.textContent = '';
    title.textContent = c ? 'تعديل بيانات العميل' : 'إضافة عميل'; save.textContent = c ? 'حفظ التعديلات' : 'حفظ العميل'; cancel.hidden = !c;
    const phoneOptional = !!c && !c.phone; // عميل بلا هاتف: الهاتف اختياري عند تعديله
    phone.required = !phoneOptional;
    phone.placeholder = phoneOptional ? 'رقم الهاتف (11 رقماً، اختياري لهذا العميل)' : 'رقم الهاتف (11 رقماً)';
    name.value = c ? c.name : ''; phone.value = c ? (c.phone || '') : ''; if (c) { title.scrollIntoView({ behavior: 'smooth', block: 'center' }); name.focus(); }
  };
  const draw = () => {
    const q = normText(search.value), rows = all.filter(c => !q || normText(c.name).includes(q) || (c.phone || '').includes(q)).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    info.textContent = `عدد العملاء: ${rows.length}${q ? ` من ${all.length}` : ''}`;
    body.replaceChildren(...rows.map(c => el('tr', {}, el('td', {}, el('a', { href: `#/customer?id=${c.id}`, textContent: c.name })), el('td', { textContent: c.phone || '—' }), el('td', {}, el('div', { className: 'acts' },
      el('button', { className: 'btn', type: 'button', textContent: 'تعديل', onclick: () => setMode(c) }),
      el('button', { className: 'btn', type: 'button', textContent: 'تحصيل دفعة', onclick: () => openCollect(c.id) }),
      el('button', { className: 'btn danger', type: 'button', textContent: 'حذف', onclick: async () => {
        err.textContent = '';
        if (!confirm(`حذف العميل «${c.name}» نهائياً؟ لا يمكن التراجع عن الحذف.`)) return;
        try { await deleteCustomer(c.id); all = all.filter(x => x.id !== c.id); if (editing?.id === c.id) setMode(null); draw(); }
        catch (x) { err.textContent = x.message; }
      } }))))));
    empty.hidden = rows.length > 0; table.hidden = rows.length === 0;
  };
  form.onsubmit = async e => {
    e.preventDefault(); err.textContent = '';
    const n = name.value.trim(); let p;
    if (n.length < 2) { err.textContent = 'اسم العميل مطلوب'; return; }
    try { p = editing ? phoneForUpdate(phone.value, editing.phone) : normalizePhone(phone.value); }
    catch (x) { err.textContent = x.message; return; }
    save.disabled = true;
    try {
      if (editing) { const u = await updateCustomer(editing.id, { name: n, phone: p }); all = all.map(c => c.id === u.id ? u : c); setMode(null); }
      else { all.push(await addCustomer({ name: n, phone: p })); form.reset(); }
      draw();
    } catch (x) { err.textContent = 'تعذّر الحفظ: ' + x.message; } finally { save.disabled = false; }
  };
  cancel.onclick = () => setMode(null);
  search.oninput = draw;
  phone.oninput = () => { phone.value = toLatinDigits(phone.value).replace(/\D/g, '').slice(0, 11); };
  v.append(el('div', { className: 'card' }, title, form, err), el('div', { className: 'card' }, search, info, table, empty));
  draw();
  const ed = params?.get('edit'); if (ed) { const c = all.find(x => x.id === ed); if (c) setMode(c); }
}
