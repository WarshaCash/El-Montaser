// عامل الخدمة: يجعل النظام يُفتح كتطبيق حتى مع ضعف الإنترنت.
// الاستراتيجية: الشبكة أولاً (فتظهر التحديثات فور نشرها) ثم النسخة المخزّنة عند الفشل أو البطء.
// لا يعترض أي طلب لخادم آخر (مثل Apps Script) ولا طلبات الكتابة: المزامنة لها منطقها الخاص.
const CACHE = 'almontaser-shell-v1';
const SHELL = ['./', 'index.html', 'css/app.css', 'js/bundle.js', 'assets/logo.webp', 'manifest.webmanifest', 'assets/icon-192.png'];
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const fallback = () => cache.match(request, { ignoreSearch: true }).then((hit) => hit || (request.mode === 'navigate' ? cache.match('index.html') : undefined));
    try {
      const response = await Promise.race([
        fetch(request),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT_MS)),
      ]);
      if (response.ok) cache.put(request, response.clone());
      return response;
    } catch {
      return (await fallback()) || Response.error();
    }
  })());
});
