// تحسينات اللمس بلا لمس الشاشات: لوحة مفاتيح الأرقام للمبالغ والكميات، ولوحة الهاتف لحقول الهاتف، وزر «التالي» على لوحة المفاتيح.
const PHONE = /هاتف|11 رقم/;

function enhance(input) {
  if (input.dataset.te || input.type === 'checkbox' || input.type === 'radio') return;
  input.dataset.te = '1';
  if (input.type === 'number') {
    input.inputMode = Number(input.step) === 1 || input.step === '' ? 'numeric' : 'decimal';
  } else if (PHONE.test(`${input.placeholder} ${input.closest('label')?.textContent || ''}`)) {
    input.inputMode = 'tel';
    input.autocomplete = 'tel';
  }
  if (input.tagName === 'INPUT' && input.type !== 'search') input.enterKeyHint = 'next';
}

export function initTouchEnhance(root) {
  let queued = false;
  const run = () => { queued = false; root.querySelectorAll('input').forEach(enhance); };
  new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(run); } }).observe(document.body, { childList: true, subtree: true });
  run();
}
