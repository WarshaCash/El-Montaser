import { renderExpenses } from './expensesPage.js';

export const expensesFeature = {
  id: 'expenses',
  routes: [{ path: '/expenses', title: 'المصروفات', render: renderExpenses }],
  nav: [{ id: 'expenses', order: 55, label: 'المصروفات', path: '/expenses', icon: 'M6 3h12l2 5H4zM4 8v13h16V8M9 13h6' }],
};
