import {getKV} from '../../infrastructure/db/store.js';
import {renderNew} from './invoiceEditor.js';
import {renderList} from './invoiceList.js';
import {renderInvoice} from './invoiceView.js';
import {renderArchive} from './invoiceArchive.js';
import {applyPageNumbers} from './sheet.js';

const invoicesFeature = {
  id: 'invoices',
  routes: [
    { path: '/invoices/new', title: 'إنشاء فاتورة جديدة', render: renderNew },
    { path: '/invoices', title: 'جميع الفواتير', render: renderList },
    { path: '/invoice', title: 'الفاتورة', render: renderInvoice, navPath: '/invoices' },
    { path: '/invoice/edit', title: 'تعديل الفاتورة', render: renderNew, navPath: '/invoices' },
    { path: '/archive', title: 'الأرشيف', render: renderArchive },
  ],
  nav: [
    { id: 'invoices', order: 20, label: 'الفواتير', path: '/invoices', icon: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7',
      sub: [
        { label: 'إنشاء فاتورة جديدة', path: '/invoices/new', order: 10 },
        { label: 'جميع الفواتير', path: '/invoices', order: 20 },
      ] },
    { id: 'archive', order: 40, label: 'الأرشيف', path: '/archive', icon: 'M3 4h18v4H3zM5 8v12h14V8M10 12h4' },
  ],
  onStart: () => getKV('settings', 'pageNumbers', false).then(applyPageNumbers).catch(() => {}),
};

export {invoicesFeature};
