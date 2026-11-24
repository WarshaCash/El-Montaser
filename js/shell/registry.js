// سجل الميزات: القائمة الوحيدة التي تُعدَّل عند إضافة ميزة جديدة. الترتيب هنا لا يؤثر على القائمة الجانبية (لها order).
import { financeFeature } from '../features/finance/feature.js';
import { customersFeature } from '../features/customers/feature.js';
import { invoicesFeature } from '../features/invoices/feature.js';
import { settingsFeature } from '../features/settings/feature.js';
import { expensesFeature } from '../features/expenses/feature.js';

export const FEATURES = [
  financeFeature, invoicesFeature, customersFeature, expensesFeature, settingsFeature,
];
