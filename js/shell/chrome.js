// سلوك الإطار العام للصفحة: طي القائمة الجانبية، زر البحث السريع، وزر التحصيل.
import { openPalette, initShortcuts } from '../features/quickAccess/quick.js';

const isMobile = () => matchMedia('(max-width:800px)').matches;

function rememberCollapsed(collapsed) {
  try { localStorage.setItem('sidebarCollapsed', collapsed ? '1' : '0'); } catch { /* التخزين غير متاح: لا يهم */ }
}

export function initChrome() {
  const body = document.body;
  try {
    const saved = localStorage.getItem('sidebarCollapsed');
    // اختيار المستخدم أولاً؛ وبدونه تبدأ القائمة مطوية (أيقونات) على التابلت واللابتوب الصغير ليتسع المحتوى
    if (saved === '1' || (saved === null && matchMedia('(max-width:1100px)').matches)) body.classList.add('collapsed');
  } catch { /* بلا ذاكرة */ }
  document.getElementById('toggle').onclick = () => {
    if (isMobile()) return body.classList.toggle('open');
    rememberCollapsed(body.classList.toggle('collapsed'));
  };
  document.getElementById('shade').onclick = () => body.classList.remove('open');
  document.getElementById('gsearch').onclick = () => openPalette();
  document.getElementById('qcollect').onclick = () => openPalette('collect');
  initShortcuts();
}
