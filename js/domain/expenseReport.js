// تقرير مصروفات الشهر: ملف CSV (يفتح في Excel) وصفحة HTML جاهزة للطباعة A4. دوال نقية تُستعمل للطباعة والنسخ الاحتياطي معاً.
import { formatEGP, formatDate } from '../core/formatters.js';
import { expenseTitle, monthBounds, monthLabel, summarizeExpenses, summarizePayroll, workshopName } from './expenses.js';

export const egp = (piastres) => (piastres / 100).toFixed(2);
const csvCell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function payrollCsvRows(rows) {
  const pay = summarizePayroll(rows);
  if (!pay.workers.length) return [];
  return [[], ['', '', '', 'كشف مرتبات الصنايعية', 'مرتبات + سلف', 'الإجمالي'],
    ...pay.workers.map((r) => ['', '', '', r.workerName, `${egp(r.salary)} + ${egp(r.advance)}`, egp(r.total)])];
}

/** CSV بترميز UTF-8 مع BOM ليقرأه Excel عربياً: الصفوف ثم إجمالي كل ورشة والإجمالي العام. */
export function expenseCsv(rows) {
  const sum = summarizeExpenses(rows);
  const table = [
    ['م', 'التاريخ', 'البند', 'خاص بـ', 'ملاحظات', 'المبلغ (جنيه)'],
    ...rows.map((e, i) => [i + 1, e.date, expenseTitle(e), workshopName(e.workshop), e.notes || '', egp(e.amountPiastres)]),
    [],
    ...sum.byWorkshop.map((g) => ['', '', '', `إجمالي ${g.name}`, '', egp(g.total)]),
    ['', '', '', 'إجمالي المصروفات', '', egp(sum.total)],
    ...payrollCsvRows(rows),
  ];
  return '\ufeff' + table.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

const STYLE = `
@page{size:A4 portrait;margin:12mm}
*{box-sizing:border-box}
body{margin:0;font-family:"Segoe UI",Tahoma,"Noto Naskh Arabic",Arial,sans-serif;color:#241206;font-size:12px;line-height:1.5;
  -webkit-print-color-adjust:exact;print-color-adjust:exact}
.head{text-align:center;border-bottom:3px solid #F9C063;padding-bottom:8px;margin-bottom:12px}
.head h1{margin:0;font-size:18px;color:#241206}.head h2{margin:6px 0 0;font-size:15px}.head p{margin:2px 0 0;color:#817466}
table{width:100%;border-collapse:collapse}
thead{display:table-header-group}tr{page-break-inside:avoid}
th{background:#241206;color:#fff;padding:6px 8px;text-align:right}
td{padding:5px 8px;border-bottom:1px solid #E3D5C2;vertical-align:top}
.n{width:32px;text-align:center}.amt{text-align:left;white-space:nowrap;font-weight:700}
.empty{text-align:center;color:#817466;padding:18px}
.sec{margin:18px 0 6px;font-size:14px;color:#241206}
.sum{width:55%;margin-top:16px;page-break-inside:avoid}
.sum td{border-bottom:1px solid #E3D5C2}.sum .tot td{border-top:2px solid #241206;border-bottom:0;font-size:14px;font-weight:700}
.foot{margin-top:14px;color:#817466;font-size:11px}`;

function payrollHtml(rows) {
  const pay = summarizePayroll(rows);
  if (!pay.workers.length) return '';
  const line = (name, r) => `<tr><td>${esc(name)}</td><td class="amt">${formatEGP(r.salary)}</td>`
    + `<td class="amt">${formatEGP(r.advance)}</td><td class="amt">${formatEGP(r.total)}</td></tr>`;
  return '<h3 class="sec">كشف مرتبات الصنايعية</h3>'
    + '<table><thead><tr><th>الصنايعي</th><th>المرتبات</th><th>السلف</th><th>الإجمالي</th></tr></thead>'
    + `<tbody>${pay.workers.map((r) => line(r.workerName, r)).join('')}${line('الإجمالي', pay)}</tbody></table>`;
}

/** صفحة HTML مستقلة لكل شهر: من أول الشهر إلى آخر يوم فيه، وإجمالي كل ورشة والإجمالي العام. */
export function expenseReportHtml({ business, ym, rows, printedAt }) {
  const { from, to } = monthBounds(ym), sum = summarizeExpenses(rows);
  const body = rows.length
    ? rows.map((e, i) => `<tr><td class="n">${i + 1}</td><td>${formatDate(e.date)}</td><td>${esc(expenseTitle(e))}</td>`
      + `<td>${esc(workshopName(e.workshop))}</td><td>${esc(e.notes)}</td>`
      + `<td class="amt">${formatEGP(e.amountPiastres)}</td></tr>`).join('')
    : '<tr><td colspan="6" class="empty">لا توجد مصروفات في هذا الشهر</td></tr>';
  const totals = sum.byWorkshop.map((g) => `<tr><td>إجمالي ${esc(g.name)}</td><td class="amt">${formatEGP(g.total)}</td></tr>`).join('');
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>مصروفات ${esc(monthLabel(ym))}</title>`
    + `<style>${STYLE}</style></head><body>`
    + `<div class="head"><h1>${esc(business)}</h1><h2>كشف مصروفات شهر ${esc(monthLabel(ym))}</h2>`
    + `<p>من ${formatDate(from)} إلى ${formatDate(to)}</p></div>`
    + `<table><thead><tr><th class="n">م</th><th>التاريخ</th><th>البند</th><th>خاص بـ</th><th>ملاحظات</th><th>المبلغ</th></tr></thead>`
    + `<tbody>${body}</tbody></table>`
    + `<table class="sum"><tbody>${totals}`
    + `<tr class="tot"><td>إجمالي المصروفات</td><td class="amt">${formatEGP(sum.total)}</td></tr></tbody></table>`
    + payrollHtml(rows)
    + `<p class="foot">عدد المصروفات: ${sum.count} — طُبع بتاريخ ${formatDate(printedAt)}</p></body></html>`;
}
