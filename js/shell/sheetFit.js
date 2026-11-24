// معاينة ورقة الفاتورة (A4) على الشاشات الضيقة: تُصغَّر لتناسب العرض بدل أن تتقطع، ويبقى تخطيطها كما سيُطبع تماماً.
// التصغير للعرض فقط (zoom)، ويُلغى عند الطباعة بقاعدة CSS، ولا يمس نسخة PDF ولا قياس الورقة.
const A4_WIDTH_PX = 793.7; // 210mm

function fit(sheet) {
  if (sheet.closest('.pdf') || sheet.classList.contains('pdf') || sheet.classList.contains('measuring')) return;
  const holder = sheet.parentElement;
  if (!holder) return;
  const style = getComputedStyle(holder);
  const available = holder.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const scale = available > 0 ? Math.min(1, available / A4_WIDTH_PX) : 1;
  const value = scale < 0.995 ? String(Number(scale.toFixed(4))) : '';
  if (sheet.style.zoom !== value) { sheet.style.zoom = value; sheet.style.maxWidth = value ? 'none' : ''; }
}

export function initSheetFit(root) {
  let queued = false;
  const run = () => { queued = false; root.querySelectorAll('.sheet').forEach(fit); };
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(run); } };
  new MutationObserver(schedule).observe(root, { childList: true, subtree: true });
  new ResizeObserver(schedule).observe(root);
  run();
}
