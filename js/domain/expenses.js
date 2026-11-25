// المصروفات: الورشة المصروف عليها، التحقق من المدخلات، والتجميع الشهري. دوال نقية (بلا واجهة ولا قاعدة بيانات).

import {normText} from '../core/validators.js';

const DEFAULT_BUSINESS_NAME = 'المنتصر';

/** جهات الصرف: كل مصروف جديد يخصّ ورشة واحدة منهما. */
const WORKSHOPS = [
  { id: 'carpentry', name: 'ورشة النجارة' },
  { id: 'paint', name: 'ورشة الدهانات' },
];
/** مرتبات الصنايعية: نوعان، كل منهما مصروف ببند ثابت ويُسجَّل باسم الصنايعي. */
const SALARY_TYPES = { salary: 'مرتبات الصنايعية', advance: 'سلف الصنايعية' };
const UNASSIGNED = 'غير محدد'; // مصروفات سُجّلت قبل إضافة خانة الورشة
const MONTH_NAMES = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

const workshopName = (id) => WORKSHOPS.find((w) => w.id === id)?.name || UNASSIGNED;
const businessNameFrom = (printBiz) => String(printBiz?.name || '').trim() || DEFAULT_BUSINESS_NAME;

const isMonth = (ym) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(ym));
/** الشهر YYYY-MM من تاريخ YYYY-MM-DD. */
const monthOf = (date) => String(date || '').slice(0, 7);

function parts(ym) {
  if (!isMonth(ym)) throw new Error('شهر غير صالح');
  const [year, month] = ym.split('-').map(Number);
  return { year, month };
}
/** نوفمبر 2026 */
const monthLabel = (ym) => { const { year, month } = parts(ym); return `${MONTH_NAMES[month - 1]} ${year}`; };
const monthName = (ym) => MONTH_NAMES[parts(ym).month - 1];
/** من أول الشهر إلى آخر يوم فيه (28 أو 29 أو 30 أو 31). */
function monthBounds(ym) {
  const { year, month } = parts(ym);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${ym}-01`, to: `${ym}-${String(days).padStart(2, '0')}`, days };
}
/** الشهر السابق (-1) أو التالي (+1). */
function shiftMonth(ym, by) {
  const { year, month } = parts(ym);
  const d = new Date(Date.UTC(year, month - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function isRealDate(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return false;
  const [y, mo, d] = [+m[1], +m[2], +m[3]], date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/** يتحقق من مصروف جديد ويعيده منظَّفاً؛ يرمي رسالة عربية مفهومة عند أي نقص. */
function validateExpense(input) {
  const date = String(input?.date || '').trim(), salaryType = String(input?.salaryType || '');
  const workshop = String(input?.workshop || ''), amount = input?.amountPiastres;
  if (!isRealDate(date)) throw new Error('التاريخ مطلوب وبصيغة صحيحة');
  if (salaryType && !SALARY_TYPES[salaryType]) throw new Error('نوع الدفعة: مرتب أو سلفة');
  const category = salaryType ? SALARY_TYPES[salaryType] : String(input?.category || '').trim();
  if (!category) throw new Error('البند مطلوب');
  if (category.length > 100) throw new Error('اسم البند طويل جداً');
  if (!WORKSHOPS.some((w) => w.id === workshop)) throw new Error('حدد الورشة: النجارة أو الدهانات');
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('المبلغ يجب أن يكون أكبر من صفر');
  const clean = { date, category, workshop, amountPiastres: amount, notes: String(input?.notes || '').trim() };
  if (!salaryType) return clean;
  const workerId = String(input?.workerId || ''), workerName = String(input?.workerName || '').trim();
  if (!workerId || !workerName) throw new Error('اختر الصنايعي');
  return { ...clean, salaryType, workerId, workerName };
}

/** عنوان المصروف للعرض: مرتب/سلفة تذكر اسم الصنايعي. */
const expenseTitle = (e) => (e.workerName ? `${e.category} — ${e.workerName}` : e.category);

/** يتحقق من صنايعي جديد (الاسم + الورشة، والحرفة اختيارية) ويمنع تكراره. */
function cleanWorker(input, existing = []) {
  const name = String(input?.name || '').trim().replace(/\s+/g, ' '), workshop = String(input?.workshop || '');
  if (!name) throw new Error('اسم الصنايعي مطلوب');
  if (name.length > 60) throw new Error('اسم الصنايعي طويل جداً');
  if (!WORKSHOPS.some((w) => w.id === workshop)) throw new Error('حدد ورشة الصنايعي');
  const duplicate = existing.some((x) => normText(x.name) === normText(name) && x.workshop === workshop);
  if (duplicate) throw new Error('هذا الصنايعي مسجّل بالفعل في هذه الورشة');
  return { name, workshop, trade: String(input?.trade || '').trim().slice(0, 40) };
}

/** مجموع كل صنايعي في الشهر: مرتبات وسلف وإجمالي (يتجاهل المصروفات العادية). */
function summarizePayroll(list) {
  const byWorker = new Map();
  for (const e of list.filter((x) => x.workerId)) {
    const row = byWorker.get(e.workerId) || { workerId: e.workerId, workerName: e.workerName, salary: 0, advance: 0, total: 0 };
    row[e.salaryType === 'advance' ? 'advance' : 'salary'] += e.amountPiastres;
    row.total += e.amountPiastres;
    byWorker.set(e.workerId, row);
  }
  const workers = [...byWorker.values()].sort((a, b) => a.workerName.localeCompare(b.workerName, 'ar'));
  const add = (key) => workers.reduce((s, r) => s + r[key], 0);
  return { workers, salary: add('salary'), advance: add('advance'), total: add('total') };
}

const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
/** المصروفات الفعّالة لشهر واحد مرتبة بالتاريخ (الملغاة بقيد عكسي لا تُحسب). */
const monthExpenses = (expenses, ym) => expenses.filter((e) => e.status === 'active' && monthOf(e.date) === ym).sort(byDate);

/** إجمالي وعدد لكل ورشة؛ «غير محدد» يظهر فقط إن وُجدت مصروفات قديمة بلا ورشة. */
function summarizeExpenses(list) {
  const groups = WORKSHOPS.map((w) => ({ id: w.id, name: w.name, count: 0, total: 0 }));
  const other = { id: '', name: UNASSIGNED, count: 0, total: 0 };
  for (const e of list) {
    const group = groups.find((g) => g.id === e.workshop) || other;
    group.count += 1;
    group.total += e.amountPiastres;
  }
  if (other.count) groups.push(other);
  return { count: list.length, total: groups.reduce((sum, g) => sum + g.total, 0), byWorkshop: groups };
}

/** الشهور التي فيها مصروفات فعّالة، الأحدث أولاً، مع ملخص كل شهر. */
function expenseMonths(expenses) {
  const months = [...new Set(expenses.filter((e) => e.status === 'active').map((e) => monthOf(e.date)).filter(isMonth))];
  return months.sort().reverse().map((ym) => ({ ym, ...summarizeExpenses(monthExpenses(expenses, ym)) }));
}

export {DEFAULT_BUSINESS_NAME, WORKSHOPS, SALARY_TYPES, workshopName, businessNameFrom, isMonth, monthOf, monthLabel, monthName, monthBounds, shiftMonth, validateExpense, expenseTitle, cleanWorker, summarizePayroll, monthExpenses, summarizeExpenses, expenseMonths};
