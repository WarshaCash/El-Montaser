// تفقيط المبالغ بالعربية (جنيه مصري). المدخل بالقروش (عدد صحيح). مثال: 10300000 → «مائة وثلاثة آلاف جنيه فقط لا غير»
const ONES = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
const TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const HUND = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
const SCALES = [['ألف', 'ألفان', 'آلاف'], ['مليون', 'مليونان', 'ملايين'], ['مليار', 'ملياران', 'مليارات']];

/** 1..999 */
function below1000(n) {
  const h = Math.floor(n / 100), r = n % 100, out = [];
  if (h) out.push(HUND[h]);
  if (r) out.push(r < 20 ? ONES[r] : (r % 10 ? ONES[r % 10] + ' و' : '') + TENS[Math.floor(r / 10)]);
  return out.join(' و');
}
/** عدد صحيح موجب → كلمات */
export function numberInWords(n) {
  if (!Number.isInteger(n) || n < 0) throw new Error('عدد غير صالح');
  if (n === 0) return 'صفر';
  const groups = []; let x = n; while (x > 0) { groups.push(x % 1000); x = Math.floor(x / 1000); }
  const parts = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i]; if (!g) continue;
    if (i === 0) { parts.push(below1000(g)); continue; }
    const [one, two, many] = SCALES[i - 1], r = g % 100;
    if (g === 1) parts.push(one); else if (g === 2) parts.push(two);
    else if (g === 200) parts.push('مائتا ' + one);
    else parts.push(below1000(g) + ' ' + (r >= 3 && r <= 10 ? many : one));
  }
  return parts.join(' و');
}
const unit = (n, one, two, many, single) => n === 1 ? single : n === 2 ? two : (n % 100 >= 3 && n % 100 <= 10) ? many : one;
export function amountInWords(piastres) {
  if (!Number.isInteger(piastres) || piastres < 0) return '';
  const pounds = Math.floor(piastres / 100), pt = piastres % 100, out = [];
  if (pounds || !pt) out.push(pounds === 1 ? 'جنيه واحد' : pounds === 2 ? 'جنيهان' : `${numberInWords(pounds)} ${unit(pounds, 'جنيه', '', 'جنيهات', '')}`);
  if (pt) out.push(pt === 1 ? 'قرش واحد' : pt === 2 ? 'قرشان' : `${numberInWords(pt)} ${unit(pt, 'قرش', '', 'قروش', '')}`);
  return out.join(' و') + ' فقط لا غير';
}
