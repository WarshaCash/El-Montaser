// قسم المصروفات: تسجيل مصروف (مع الورشة المصروف عليها) + ملف مستقل لكل شهر من 1 إلى آخر يوم، قابل للطباعة.
import { el } from '../../core/dom.js';
import { getAll, getKV } from '../../infrastructure/db/store.js';
import { addMoney, reverseRecord } from '../../infrastructure/repositories/ledgerRepository.js';
import { formatEGP, formatDate, parsePiastres, localToday } from '../../core/formatters.js';
import {
  WORKSHOPS, businessNameFrom, expenseMonths, expenseTitle, isMonth, monthBounds, monthExpenses,
  monthLabel, monthOf, shiftMonth, summarizeExpenses, workshopName,
} from '../../domain/expenses.js';
import { expenseReportHtml } from '../../domain/expenseReport.js';
import { toast } from '../../ui/ui.js';
import { navigate } from '../../shell/router.js';
import { listWorkers } from '../../infrastructure/repositories/workerRepository.js';
import { chip, goTo, kpi, lab, table } from './parts.js';
import { payrollCard, payrollSummary } from './payrollCard.js';

/** طباعة تقرير الشهر من صفحة مستقلة داخل إطار مخفي، فلا تتأثر بقائمة التطبيق ولا بأنماطه. */
function printHtml(html) {
  document.querySelectorAll('iframe[data-print]').forEach((old) => old.remove());
  const frame = el('iframe', { title: 'طباعة المصروفات', srcdoc: html, className: 'print-frame' });
  frame.dataset.print = 'expenses';
  frame.onload = () => { frame.contentWindow.focus(); frame.contentWindow.print(); };
  document.body.append(frame);
}

function entryForm(categories, error) {
  const date = el('input', { type: 'date', value: localToday(), required: true });
  const category = el('input', { placeholder: 'بند المصروف (خامات، بنزين...)', required: true });
  category.setAttribute('list', 'expense-categories');
  const choices = WORKSHOPS.map((w) => el('option', { value: w.id, textContent: w.name }));
  const workshop = el('select', { required: true }, el('option', { value: '', textContent: '— اختر الورشة —' }), ...choices);
  const amount = el('input', { placeholder: 'المبلغ بالجنيه', inputMode: 'decimal', required: true });
  const notes = el('input', { placeholder: 'ملاحظات (اختياري)' });
  const form = el('form', { className: 'row', onsubmit: async (event) => {
    event.preventDefault();
    error.textContent = '';
    try {
      const record = await addMoney('expense', {
        date: date.value, category: category.value, workshop: workshop.value,
        amountPiastres: parsePiastres(amount.value), notes: notes.value,
      });
      toast(`تم تسجيل المصروف على ${workshopName(record.workshop)} ✓`);
      goTo(monthOf(record.date));
    } catch (e) { error.textContent = e.message; }
  } }, lab('التاريخ', date), lab('البند', category), lab('خاص بـ', workshop), lab('المبلغ', amount), lab('ملاحظات', notes),
  el('button', { className: 'btn', type: 'submit', textContent: 'تسجيل المصروف' }));
  const list = el('datalist', { id: 'expense-categories' }, ...categories.map((c) => el('option', { value: c })));
  return el('div', { className: 'card no-print' }, el('h3', { textContent: 'تسجيل مصروف' }), form, list);
}

function monthFile({ ym, rows, business, error }) {
  const { from, to } = monthBounds(ym), sum = summarizeExpenses(rows);
  const picker = el('input', { type: 'month', value: ym, onchange: (e) => { if (isMonth(e.target.value)) goTo(e.target.value); } });
  const nav = el('div', { className: 'row no-print' }, lab('الشهر', picker),
    el('button', { className: 'btn light', type: 'button', textContent: '◀ الشهر السابق', onclick: () => goTo(shiftMonth(ym, -1)) }),
    el('button', { className: 'btn light', type: 'button', textContent: 'الشهر التالي ▶', onclick: () => goTo(shiftMonth(ym, 1)) }),
    el('button', { className: 'btn light', type: 'button', textContent: 'الشهر الحالي', onclick: () => goTo(localToday().slice(0, 7)) }),
    el('button', { className: 'btn', type: 'button', textContent: 'طباعة مصروفات الشهر', onclick: () => {
      if (!rows.length) return toast('لا توجد مصروفات في هذا الشهر لطباعتها');
      printHtml(expenseReportHtml({ business, ym, rows, printedAt: localToday() }));
    } }));
  const cancel = (e) => el('button', { className: 'btn danger no-print', type: 'button', textContent: 'إلغاء', onclick: async () => {
    const reason = prompt('سبب إلغاء المصروف (مطلوب):');
    if (reason === null) return;
    error.textContent = '';
    try {
      await reverseRecord('expense', e.id, reason);
      toast('أُلغي المصروف بقيد عكسي');
      navigate();
    } catch (x) { error.textContent = x.message; }
  } });
  const body = rows.length
    ? table(['م', 'التاريخ', 'البند', 'خاص بـ', 'ملاحظات', 'المبلغ', ''],
      rows.map((e, i) => [
        i + 1, formatDate(e.date), expenseTitle(e), chip(e.workshop), e.notes || '—', formatEGP(e.amountPiastres), cancel(e),
      ]))
    : el('div', { className: 'empty', textContent: 'لا توجد مصروفات في هذا الشهر.' });
  return el('div', { className: 'card' }, el('h3', { textContent: `ملف مصروفات شهر ${monthLabel(ym)}` }),
    el('p', { className: 'grp-h', textContent: `من ${formatDate(from)} إلى ${formatDate(to)}` }), nav,
    el('div', { className: 'grid' }, kpi('إجمالي مصروفات الشهر', formatEGP(sum.total)),
      ...sum.byWorkshop.map((g) => kpi(g.name, formatEGP(g.total)))),
    body, payrollSummary(rows) || '',
    el('p', { className: 'grp-h no-print', textContent: 'المصروفات الملغاة لا تُحسب هنا ولا تُطبع، وقيودها العكسية في الخزينة.' }));
}

function monthsList(months, current) {
  const heads = ['الشهر', 'عدد المصروفات', ...WORKSHOPS.map((w) => w.name), 'الإجمالي'];
  const rows = months.map((m) => [
    el('a', { href: `#/expenses?m=${m.ym}`, textContent: monthLabel(m.ym), className: m.ym === current ? 'cur' : '' }), m.count,
    ...WORKSHOPS.map((w) => formatEGP(m.byWorkshop.find((g) => g.id === w.id).total)), formatEGP(m.total)]);
  return el('div', { className: 'card no-print' }, el('h3', { textContent: 'ملفات الشهور' }),
    months.length ? table(heads, rows) : el('div', { className: 'empty', textContent: 'لا توجد مصروفات مسجلة بعد.' }));
}

export async function renderExpenses(view, params) {
  const [expenses, biz, workers] = await Promise.all([getAll('expenses'), getKV('settings', 'printBiz', {}), listWorkers()]);
  const asked = params.get('m'), ym = isMonth(asked) ? asked : localToday().slice(0, 7);
  const error = el('div', { className: 'err no-print' });
  const categories = [...new Set(expenses.map((e) => e.category).filter(Boolean))].sort();
  view.append(entryForm(categories, error), payrollCard({ workers, error }), error,
    monthFile({ ym, rows: monthExpenses(expenses, ym), business: businessNameFrom(biz), error }),
    monthsList(expenseMonths(expenses), ym));
}
