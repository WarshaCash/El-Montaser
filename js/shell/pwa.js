// تسجيل عامل الخدمة (فتح النظام كتطبيق وبسرعة حتى مع ضعف الإنترنت). لا يعمل عند الفتح المباشر من file://.
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
