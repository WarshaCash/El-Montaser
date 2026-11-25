// واجهة المزامنة: شارة الحالة في الشريط العلوي، وشاشة الدخول بالرمز السري، وتحديث الشاشة عند وصول بيانات جديدة.

import {el} from '../core/dom.js';
import {syncConfig} from '../infrastructure/sync/state.js';
import {onStatus, startSync, syncNow, linkBeforeStart} from '../infrastructure/sync/engine.js';
import {DATA_EVENT} from '../infrastructure/sync/applyRemote.js';
import {navigate} from './router.js';
import {toast} from '../ui/ui.js';

const BADGES = {
  idle: ['✓ محفوظ', 'ok'], syncing: ['⟳ جارٍ الحفظ…', 'busy'], offline: ['⚠ بلا إنترنت', 'warn'],
  error: ['⚠ تعذّر الحفظ', 'warn'], auth: ['🔒 تواصل مع المبرمج', 'bad'],
};
const LIVE_ROUTES = new Set(['/', '/invoices', '/customers', '/accounts', '/treasury', '/expenses']);

/** شاشة انتظار قصيرة عند أول فتح على جهاز جديد فقط: تُحمَّل البيانات من الشيت قبل رسم الشاشات (بلا أي إدخال). */
function showSplash() {
  const note = el('p', { className: 'gate-msg', textContent: 'جارٍ تحميل البيانات…' });
  note.style.color = 'var(--muted)';
  const overlay = el('div', { className: 'gate' }, el('div', { className: 'gate-box' },
    el('img', { src: 'assets/logo.webp', alt: '', className: 'gate-logo' }), el('h2', { textContent: 'المنتصر' }), note));
  document.body.append(overlay);
  return { done: () => overlay.remove() };
}

function initBadge() {
  const badge = el('button', { id: 'syncbadge', className: 'sync-badge', type: 'button', hidden: true });
  document.querySelector('.top-actions')?.prepend(badge);
  badge.onclick = () => { if (badge.dataset.state !== 'auth') syncNow().catch(() => {}); };
  let wasOffline = false; // الحالة تمر بـ«جارٍ الحفظ» بين «بلا إنترنت» و«محفوظ»، فلا نكتفي بمقارنة الحالة السابقة
  onStatus((s) => {
    if (s.state === 'offline' && !wasOffline) toast('لا يوجد إنترنت — تابع العمل بشكل طبيعي، تُحفظ التغييرات على الجهاز وتُرسل تلقائياً عند عودة الاتصال');
    if (s.state === 'idle' && wasOffline && !s.pending) toast('عاد الاتصال وتمت مزامنة كل التغييرات ✓');
    if (s.state === 'offline') wasOffline = true; else if (s.state === 'idle' && !s.pending) wasOffline = false;
    const [text, tone] = BADGES[s.state] || ['', ''];
    badge.hidden = s.state === 'off';
    badge.dataset.state = s.state;
    badge.className = `sync-badge ${tone}`;
    badge.textContent = s.pending && s.state !== 'syncing' ? `${text} (${s.pending})` : text;
    badge.title = s.message || (s.lastSyncAt ? 'آخر مزامنة: ' + new Date(s.lastSyncAt).toLocaleTimeString('ar-EG') : '');
  });
}

function initLiveRefresh() {
  let timer = null;
  addEventListener(DATA_EVENT, () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const path = (location.hash.slice(1) || '/').split('?')[0];
      const active = document.activeElement;
      const typing = active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName);
      if (LIVE_ROUTES.has(path) && !typing && !document.querySelector('.gate, .palette, dialog[open]')) navigate();
    }, 300);
  });
}

/** يعمل قبل رسم أي شاشة: وضع محلي إن لم تُضبط المزامنة في الكود، وإلا ربط تلقائي ثم بدء المزامنة. */
async function bootSync() {
  initBadge();
  initLiveRefresh();
  const config = syncConfig();
  if (!config.url || !config.token) return;
  if (!config.linked) {
    const splash = showSplash();
    await linkBeforeStart();
    splash.done();
  }
  startSync();
}

export {bootSync};
