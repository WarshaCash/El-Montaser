// تسجيل عامل الخدمة (فتح النظام كتطبيق وبسرعة حتى مع ضعف الإنترنت). لا يعمل عند الفتح المباشر من file://.

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

/** يطلب من المتصفح عدم حذف بيانات النظام عند ضيق المساحة (مهم لبيانات لم تُرسل بعد للشيت). صامت، والقرار للمتصفح. */
async function keepDataPersistent() {
  try { if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist(); } catch { /* اختياري */ }
}

export {registerServiceWorker, keepDataPersistent};
