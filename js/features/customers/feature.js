import { renderCustomers } from './customers.js';

export const customersFeature = {
  id: 'customers',
  routes: [{ path: '/customers', title: 'العملاء', render: renderCustomers }],
  nav: [{
    id: 'customers', order: 30, label: 'العملاء', path: '/customers', icon: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 4-6 8-6s8 2 8 6',
    sub: [{ label: 'قائمة العملاء', path: '/customers' }],
  }],
};
