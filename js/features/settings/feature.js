import { renderSettings } from './settings.js';

export const settingsFeature = {
  id: 'settings',
  routes: [{ path: '/settings', title: 'الإعدادات والنسخ الاحتياطي', render: renderSettings }],
  nav: [{
    id: 'settings', order: 90, label: 'الإعدادات', path: '/settings',
    icon: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19 12l2-1-2-4-2 1-2-1V5H9v2L7 8 5 7 3 11l2 1v2l-2 1 2 4 2-1 2 1v2h6v-2l2-1 2 1 2-4-2-1z',
    sub: [{ label: 'الإعدادات العامة', path: '/settings', order: 10 }],
  }],
};
