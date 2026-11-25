// شريط التنقل السفلي للجوال والتابلت الصغير: الوصول بإبهام واحد لأهم ما يحتاجه صاحب الورشة (فاتورة جديدة، تحصيل، عملاء).

import {el} from '../core/dom.js';
import {openPalette} from '../features/quickAccess/quick.js';

const ICONS = {
  home: 'M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z',
  customers: 'M16 11a4 4 0 10-8 0 4 4 0 008 0zM4 21a8 8 0 0116 0',
  collect: 'M12 3v18M17 7.5c0-1.9-2.2-3-5-3s-5 1.1-5 3 2.2 2.8 5 3.5 5 1.6 5 3.5-2.2 3-5 3-5-1.1-5-3',
  plus: 'M12 5v14M5 12h14',
  menu: 'M4 6h16M4 12h16M4 18h16',
};

const icon = (path) => {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('class', 'ic');
  const p = document.createElementNS(ns, 'path'); p.setAttribute('d', path); svg.append(p);
  return svg;
};

const ITEMS = [
  { id: 'home', label: 'الرئيسية', path: '/', icon: ICONS.home },
  { id: 'customers', label: 'العملاء', path: '/customers', icon: ICONS.customers },
  { id: 'new', label: 'فاتورة جديدة', path: '/invoices/new', icon: ICONS.plus, primary: true },
  { id: 'collect', label: 'تحصيل', run: () => openPalette('collect'), icon: ICONS.collect },
  { id: 'menu', label: 'القائمة', run: () => document.body.classList.toggle('open'), icon: ICONS.menu },
];

function initMobileNav() {
  const bar = el('nav', { id: 'bottomnav' });
  bar.setAttribute('aria-label', 'التنقل السريع');
  for (const item of ITEMS) {
    const node = el(item.path ? 'a' : 'button', { className: `bn${item.primary ? ' primary' : ''}` },
      el('span', { className: 'bn-ic' }, icon(item.icon)), el('span', { className: 'bn-tx', textContent: item.label }));
    node.dataset.id = item.id;
    if (item.path) node.href = `#${item.path}`; else { node.type = 'button'; node.onclick = item.run; }
    bar.append(node);
  }
  document.body.append(bar);
  const mark = () => {
    const path = (location.hash.slice(1) || '/').split('?')[0];
    bar.querySelectorAll('.bn[href]').forEach((a) => a.classList.toggle('on', a.getAttribute('href') === `#${path}`));
    document.body.classList.remove('open');
  };
  addEventListener('hashchange', mark);
  mark();
}

export {initMobileNav};
