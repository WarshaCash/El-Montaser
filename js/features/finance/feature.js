import { renderDashboard, renderProfile, renderCollectPage } from './desk.js';
import { renderAccounts, renderStatement, renderTreasury } from './finance.js';

export const financeFeature = {
  id: 'finance',
  routes: [
    { path: '/', title: 'الرئيسية', render: renderDashboard },
    { path: '/customer', title: 'ملف العميل', render: renderProfile, navPath: '/customers' },
    { path: '/collect', title: 'تحصيل دفعة من عميل', render: renderCollectPage },
    { path: '/accounts', title: 'الحسابات', render: renderAccounts },
    { path: '/statement', title: 'كشف حساب العميل', render: renderStatement, navPath: '/accounts' },
    { path: '/treasury', title: 'الخزينة', render: renderTreasury },
  ],
  nav: [
    { id: 'home', order: 10, label: 'الرئيسية', path: '/', icon: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10' },
    { id: 'accounts', order: 50, label: 'الحسابات', path: '/accounts', icon: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
      sub: [{ label: 'ملخص الحسابات', path: '/accounts', order: 10 }, { label: 'تحصيل دفعة من عميل', path: '/collect', order: 20 }] },
    { id: 'treasury', order: 60, label: 'الخزينة', path: '/treasury', icon: 'M3 7h18v13H3zM3 7l3-4h12l3 4M12 12v4M9 14h6' },
  ],
};
