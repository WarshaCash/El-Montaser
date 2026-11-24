// قراءة مبالغ الجنيه من حقول الإدخال وتحويلها إلى قروش، برسائل خطأ مفهومة.
import { parsePiastres } from '../../../core/formatters.js';

/** مبلغ إلزامي: يرمي خطأً إن كان الحقل فارغاً أو غير صالح. */
export function requiredMoney(input, label) {
  const text = input.value.trim();
  if (!text) throw new Error(`${label} مطلوب`);
  try { return parsePiastres(text); } catch { throw new Error(`${label}: مبلغ غير صالح`); }
}

/** مبلغ اختياري: الفارغ = 0، وغير الصالح يرمي خطأً. */
export function optionalMoney(input, label) {
  return input.value.trim() ? requiredMoney(input, label) : 0;
}

/** للمعاينة الحية فقط: القيمة غير الصالحة تُعامل كصفر بدل رمي خطأ أثناء الكتابة. */
export function previewMoney(input) {
  try { return input.value.trim() ? parsePiastres(input.value) : 0; } catch { return 0; }
}

export const piastresToInput = (piastres) => String(piastres / 100);
