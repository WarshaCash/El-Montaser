// تحقق مشترك لقواعد الأقسام. المقاسات بالسنتيمتر دائماً.

/** يتحقق أن القيمة عدد صحيح بين min و max، أو يرمي خطأً مفهوماً باسم الحقل. */
function int(value, min, max, label) {
  const n = Number(value);
  if (value === '' || !Number.isInteger(n) || n < min || n > max) {
    throw new Error(`${label} يجب أن يكون عدداً صحيحاً من ${min} إلى ${max}`);
  }
  return n;
}

/** القيمة الرقمية المُدخلة لقسم عدد/مقاس (تقبل الأسماء القديمة للحقل للتوافق مع بيانات سابقة). */
const rawNumber = (raw) => raw.value ?? raw.sizeCm ?? raw.doors ?? raw.chairs;

export {int, rawNumber};
