// يجعل كل جدول بيانات صالحاً للجوال دون لمس الشاشات: يوسم الجدول ويضيف لكل خلية عنوان عمودها،
// ثم يحوّله CSS إلى بطاقات مكدّسة على الشاشات الضيقة. جداول ورقة الفاتورة المطبوعة لا تُمس.

const SKIP = '.sheet, .lh-table, .no-stack';

function prepare(table) {
  if (table.dataset.rt || table.closest(SKIP)) return;
  const heads = [...table.querySelectorAll('thead th')].map((th) => th.textContent.trim());
  if (!heads.length) return;
  table.dataset.rt = '1';
  table.classList.add('rt');
  table.querySelectorAll('tbody tr').forEach((row) => {
    [...row.children].forEach((cell, i) => { if (heads[i] && !cell.dataset.label) cell.dataset.label = heads[i]; });
  });
}

function initResponsiveTables(root) {
  let queued = false;
  const run = () => { queued = false; root.querySelectorAll('table').forEach(prepare); };
  new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(run); } })
    .observe(root, { childList: true, subtree: true });
  run();
}

export {initResponsiveTables};
