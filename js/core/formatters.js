const AR = '٠١٢٣٤٥٦٧٨٩';
/** يحوّل نص مبلغ بالجنيه إلى قروش (عدد صحيح) دون أخطاء الفاصلة العائمة. */
function parsePiastres(input) {
  const s = String(input).trim().replace(/[٠-٩]/g, d => AR.indexOf(d)).replace(/[,٬]/g, '').replace('٫', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error('مبلغ غير صالح');
  const [a, b = ''] = s.split('.');
  return parseInt(a, 10) * 100 + parseInt((b + '00').slice(0, 2), 10);
}
/** مبلغ بأرقام لاتينية موحّدة بلا كسور صفرية: 3,000 ج.م — 3,000.50 ج.م */
const formatEGP = p => { const a = Math.abs(p), fr = a % 100; return (p < 0 ? '−' : '') + Math.floor(a / 100).toLocaleString('en-US') + (fr ? '.' + String(fr).padStart(2, '0') : '') + ' ج.م'; };
/** 2026-11-14 → 14 / 11 / 2026 */
const formatDate = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${m[3]} / ${m[2]} / ${m[1]}` : (iso || '—'); };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)));
const nowISO = () => new Date().toISOString();
/** تاريخ اليوم بالتوقيت المحلي YYYY-MM-DD (toISOString يعطي توقيت UTC فيتأخر يوماً بعد منتصف الليل في مصر). */
const localToday = () => {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export {parsePiastres, formatEGP, formatDate, uid, nowISO, localToday};
