// مرتبات الصنايعية: تسجيل صنايعي، وصرف مرتب أو سلفة له. الصرف يُحفظ كمصروف على ورشته فيدخل ملف الشهر والطباعة.
import { el } from '../../core/dom.js';
import { addMoney } from '../../infrastructure/repositories/ledgerRepository.js';
import { addWorker, setWorkerActive } from '../../infrastructure/repositories/workerRepository.js';
import { parsePiastres, formatEGP, localToday } from '../../core/formatters.js';
import { WORKSHOPS, monthOf, summarizePayroll, workshopName } from '../../domain/expenses.js';
import { toast } from '../../ui/ui.js';
import { navigate } from '../../shell/router.js';
import { chip, goTo, kpi, lab, table } from './parts.js';

const TYPE_LABEL = { salary: 'مرتب', advance: 'سلفة' };
const workshopSelect = () => el('select', { required: true }, el('option', { value: '', textContent: '— اختر الورشة —' }),
  ...WORKSHOPS.map((x) => el('option', { value: x.id, textContent: x.name })));

function payForm(workers, error) {
  const worker = el('select', { required: true }, el('option', { value: '', textContent: '— اختر الصنايعي —' }),
    ...workers.map((x) => el('option', { value: x.id, textContent: `${x.name} — ${workshopName(x.workshop)}` })));
  const type = el('select', {}, ...Object.entries(TYPE_LABEL).map(([id, name]) => el('option', { value: id, textContent: name })));
  const date = el('input', { type: 'date', value: localToday(), required: true });
  const amount = el('input', { placeholder: 'المبلغ بالجنيه', inputMode: 'decimal', required: true });
  const workshop = workshopSelect();
  const notes = el('input', { placeholder: 'عن أسبوع/شهر... (اختياري)' });
  worker.onchange = () => { workshop.value = workers.find((x) => x.id === worker.value)?.workshop || ''; }; // ورشته الأصلية، ويمكن تغييرها
  return el('form', { className: 'row', onsubmit: async (event) => {
    event.preventDefault();
    error.textContent = '';
    const chosen = workers.find((x) => x.id === worker.value);
    try {
      const record = await addMoney('expense', {
        date: date.value, salaryType: type.value, workerId: chosen?.id, workerName: chosen?.name, workshop: workshop.value,
        amountPiastres: parsePiastres(amount.value), notes: notes.value,
      });
      toast(`تم تسجيل ${TYPE_LABEL[type.value]} ${record.workerName} ✓`);
      goTo(monthOf(record.date));
    } catch (e) { error.textContent = e.message; }
  } }, lab('الصنايعي', worker), lab('النوع', type), lab('التاريخ', date), lab('المبلغ', amount),
  lab('خاص بـ', workshop), lab('ملاحظات', notes), el('button', { className: 'btn', type: 'submit', textContent: 'تسجيل الدفعة' }));
}

function workerForm(error) {
  const name = el('input', { placeholder: 'اسم الصنايعي', required: true });
  const trade = el('input', { placeholder: 'الحرفة (نجار، دهان...)' });
  const workshop = workshopSelect();
  return el('form', { className: 'row', onsubmit: async (event) => {
    event.preventDefault();
    error.textContent = '';
    try {
      const added = await addWorker({ name: name.value, workshop: workshop.value, trade: trade.value });
      toast(`أُضيف الصنايعي ${added.name} ✓`);
      navigate();
    } catch (e) { error.textContent = e.message; }
  } }, lab('الاسم', name), lab('الورشة', workshop), lab('الحرفة', trade),
  el('button', { className: 'btn light', type: 'submit', textContent: 'إضافة صنايعي' }));
}

function workersTable(workers, error) {
  const toggle = (x) => el('button', {
    className: 'btn light', type: 'button', textContent: x.active === false ? 'تفعيل' : 'إيقاف',
    onclick: async () => {
      error.textContent = '';
      try { await setWorkerActive(x.id, x.active === false); navigate(); } catch (e) { error.textContent = e.message; }
    },
  });
  return table(['الصنايعي', 'الورشة', 'الحرفة', 'الحالة', ''],
    workers.map((x) => [x.name, chip(x.workshop), x.trade || '—', x.active === false ? 'موقوف' : 'يعمل', toggle(x)]));
}

/** بطاقة التسجيل (للشاشة فقط). */
export function payrollCard({ workers, error }) {
  const active = workers.filter((x) => x.active !== false);
  return el('div', { className: 'card no-print' }, el('h3', { textContent: 'مرتبات الصنايعية' }),
    el('p', { className: 'grp-h', textContent: 'صرف مرتب أو سلفة' }),
    active.length ? payForm(active, error)
      : el('div', { className: 'empty', textContent: 'أضف صنايعياً أولاً ثم سجّل له مرتباً أو سلفة.' }),
    el('p', { className: 'grp-h', textContent: 'تسجيل صنايعي جديد' }), workerForm(error),
    workers.length
      ? el('details', {}, el('summary', { textContent: `الصنايعية المسجلون (${workers.length})` }), workersTable(workers, error)) : '');
}

/** كشف مرتبات الشهر لكل صنايعي (مرتبات + سلف)؛ لا يظهر إن لم يُصرف لأحد شيء. */
export function payrollSummary(rows) {
  const pay = summarizePayroll(rows);
  if (!pay.workers.length) return null;
  const line = (name, r) => [name, formatEGP(r.salary), formatEGP(r.advance), formatEGP(r.total)];
  return el('div', {}, el('p', { className: 'grp-h', textContent: 'كشف مرتبات الصنايعية' }),
    el('div', { className: 'grid' }, kpi('مرتبات الصنايعية', formatEGP(pay.salary)), kpi('سلف الصنايعية', formatEGP(pay.advance))),
    table(['الصنايعي', 'المرتبات', 'السلف', 'الإجمالي'], [...pay.workers.map((r) => line(r.workerName, r)), line('الإجمالي', pay)]));
}
