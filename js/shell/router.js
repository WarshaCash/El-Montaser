// التوجيه بالـ hash وبناء القائمة الجانبية. لا يعرف أي ميزة بالاسم: الميزات تسجّل نفسها عبر registerFeatures().
//
// وصف الميزة (feature descriptor):
//   routes: [{ path, title, render(view, params), navPath? }]   navPath = العنصر الذي يُضاء في القائمة لهذا المسار
//   nav:    [{ id, label, path, icon, order, sub?: [{ label, path, order? }] }]   عناصر القائمة الرئيسية
//   navSub: [{ parent, label, path, order }]   روابط فرعية تضيفها الميزة داخل مجموعة تملكها ميزة أخرى
//   onStart(): خطاف اختياري يُستدعى مرة عند بدء التطبيق
const routes = new Map();
const navGroups = [];

const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);

/** تسجيل مسار واحد (يُستعمل داخلياً ويمكن استعماله للاختبارات). */
export const route = (path, title, render, navPath = path) => routes.set(path, { title, render, navPath });

/** تسجيل ميزات كاملة: مساراتها وعناصر قائمتها. يُستدعى مرة واحدة عند البدء. */
export function registerFeatures(features) {
  for (const feature of features) {
    (feature.routes || []).forEach((r) => route(r.path, r.title, r.render, r.navPath));
    (feature.nav || []).forEach((group) => navGroups.push({ ...group, sub: [...(group.sub || [])] }));
  }
  for (const feature of features) {
    for (const { parent, ...link } of feature.navSub || []) {
      const group = navGroups.find((g) => g.id === parent);
      if (!group) throw new Error(`مجموعة القائمة «${parent}» غير موجودة`);
      group.sub.push(link);
    }
  }
  navGroups.sort(byOrder);
}

const svg = (d) => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('class', 'ic');
  const p = document.createElementNS(s.namespaceURI, 'path');
  p.setAttribute('d', d);
  s.append(p);
  return s;
};

function link(href, text, icon) {
  const a = document.createElement('a');
  a.href = '#' + href;
  a.dataset.path = href;
  a.title = text;
  if (icon) a.append(svg(icon));
  const label = document.createElement('span');
  label.className = 'label';
  label.textContent = text;
  a.append(label);
  return a;
}

export function buildNav(container) {
  for (const group of navGroups) {
    const item = document.createElement('div');
    item.className = 'nav-item';
    item.append(link(group.path, group.label, group.icon));
    if (group.sub.length) {
      const sub = document.createElement('div');
      sub.className = 'sub';
      group.sub.sort(byOrder).forEach((s) => sub.append(link(s.path, s.label)));
      item.append(sub);
    }
    container.append(item);
  }
}

function markActive(navPath) {
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.path === navPath));
  document.querySelectorAll('.nav-item').forEach((n) => n.classList.toggle('open', !!n.querySelector('a.active')));
}

const notFound = { title: 'غير موجود', render: (v) => { v.textContent = 'الصفحة غير موجودة.'; } };

export async function navigate() {
  const [path, query] = (location.hash.slice(1) || '/').split('?');
  const found = routes.get(path) || notFound;
  markActive(found.navPath || path);
  document.getElementById('title').textContent = found.title;
  const view = document.getElementById('view');
  view.replaceChildren();
  try {
    await found.render(view, new URLSearchParams(query || ''));
  } catch (error) {
    const p = document.createElement('p');
    p.className = 'err';
    p.textContent = error.message;
    view.append(p);
  }
  document.body.classList.remove('open');
}
