// ملفات JS الحديثة (ES Modules) يمنعها المتصفح عند فتح index.html بالنقر المزدوج (file://).
// بدل صفحة صامتة بلا عمل، نعرض تعليمات واضحة. على الاستضافة أو الخادم المحلي لا يظهر شيء.
(function () {
  if (location.protocol !== 'file:') return;
  document.addEventListener('DOMContentLoaded', function () {
    var box = document.createElement('div');
    box.setAttribute('role', 'alert');
    box.style.cssText = 'position:fixed;inset:0;z-index:99999;display:grid;place-items:center;padding:24px;background:#241206;color:#F7F3EC;font:16px/1.9 "Segoe UI",Tahoma,sans-serif;text-align:center';
    box.innerHTML = '<div style="max-width:560px"><h2 style="color:#F9C063;margin:0 0 12px">شغّل النظام من خادم محلي</h2>' +
      '<p>لا يمكن فتح هذه النسخة بالنقر المزدوج على index.html.<br>' +
      'افتح مجلد المشروع وشغّل الملف <b dir="ltr">start-local-server.bat</b> ثم افتح الرابط <b dir="ltr">http://localhost:8080</b><br>' +
      'أو انشر المجلد على GitHub Pages / أي استضافة.</p></div>';
    document.body.appendChild(box);
  });
})();
