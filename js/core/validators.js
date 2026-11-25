const AR = '٠١٢٣٤٥٦٧٨٩';
const toLatinDigits = s => String(s ?? '').replace(/[٠-٩]/g, d => AR.indexOf(d));
/** رقم الهاتف: 11 رقماً بالضبط، أرقام فقط (يقبل الأرقام العربية ويحوّلها). */
function normalizePhone(input) {
  const s = toLatinDigits(input).trim();
  if (!/^\d{11}$/.test(s)) throw new Error('رقم الهاتف يجب أن يكون 11 رقماً بالضبط (أرقام فقط)');
  return s;
}
/** هاتف عند تعديل عميل: الفارغ مقبول فقط لعميل لا هاتف له أصلاً (عميل قديم بلا هاتف)، وغير ذلك 11 رقماً بالضبط. */
function phoneForUpdate(input, currentPhone) {
  const blank = !String(input ?? '').trim();
  return blank && !currentPhone ? '' : normalizePhone(input);
}
/** توحيد النص العربي للبحث السريع: يتجاهل التشكيل والهمزات والتاء المربوطة والأرقام العربية. */
const normText = s => toLatinDigits(s).toLowerCase().replace(/[\u064B-\u065F\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').trim();

export {toLatinDigits, normalizePhone, phoneForUpdate, normText};
