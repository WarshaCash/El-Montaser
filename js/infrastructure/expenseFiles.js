// ملف مستقل لكل شهر داخل النسخة المفصلة (كما لكل عميل مجلده): مجلد «المصروفات/2026-11 نوفمبر».
import { localToday } from '../core/formatters.js';
import {
  businessNameFrom, isMonth, monthBounds, monthExpenses, monthName, monthOf, summarizeExpenses, summarizePayroll,
} from '../domain/expenses.js';
import { egp, expenseCsv, expenseReportHtml } from '../domain/expenseReport.js';

const json = (o) => JSON.stringify(o, null, 2);
const README = 'مجلد المصروفات: لكل شهر مجلد فيه بيانات الشهر (JSON) وجدول المصروفات (CSV يفتح في Excel)\n'
  + 'وتقرير جاهز للطباعة (HTML: افتحه في المتصفح واطبعه A4).\n'
  + 'الشهر يبدأ من يوم 1 إلى آخر يوم فيه. المصروفات الملغاة بقيد عكسي تظهر في JSON فقط ولا تدخل في الجدول والتقرير.\n';

export const expenseFolderName = (ym) => `${ym} ${monthName(ym)}`;

/** دالة نقية: تبني قائمة ملفات {path,text} لكل شهر فيه مصروفات (فعّالة أو ملغاة). */
export function buildExpenseMonthFiles(stores, printedAt = localToday()) {
  const all = stores.expenses || [], business = businessNameFrom(stores.settings?.find((s) => s.key === 'printBiz')?.value);
  const months = [...new Set(all.map((e) => monthOf(e.date)).filter(isMonth))].sort();
  if (!months.length) return [];
  const out = [{ path: 'المصروفات/اقرأني.txt', text: README }];
  for (const ym of months) {
    const base = `المصروفات/${expenseFolderName(ym)}`, rows = monthExpenses(all, ym), { from, to } = monthBounds(ym);
    const sum = summarizeExpenses(rows), byWorkshop = Object.fromEntries(sum.byWorkshop.map((g) => [g.name, egp(g.total)]));
    const payroll = Object.fromEntries(summarizePayroll(rows).workers.map((r) => [r.workerName, egp(r.total)]));
    const records = all.filter((e) => monthOf(e.date) === ym), ids = new Set(records.map((e) => e.id));
    out.push({ path: `${base}/بيانات الشهر.json`, text: json({
      الشهر: ym, من: from, إلى: to,
      الملخص: {
        'عدد المصروفات': sum.count, 'الإجمالي (جنيه)': egp(sum.total), 'حسب الورشة': byWorkshop,
        ...(Object.keys(payroll).length && { 'مرتبات وسلف الصنايعية': payroll }),
      },
      المصروفات: records,
    }) });
    out.push({ path: `${base}/المصروفات.csv`, text: expenseCsv(rows) });
    out.push({ path: `${base}/تقرير المصروفات.html`, text: expenseReportHtml({ business, ym, rows, printedAt }) });
    const audit = (stores.auditLogs || []).filter((a) => ids.has(a.refId));
    if (audit.length) out.push({ path: `${base}/سجل التدقيق.json`, text: json(audit) });
  }
  return out;
}
