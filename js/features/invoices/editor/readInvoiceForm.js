// يقرأ نموذج الفاتورة ويتحقق منه بالترتيب نفسه الذي يراه المستخدم، ويعيد ما يلزم للحفظ.

import {requiredMoney, optionalMoney} from './money.js';

/**
 * form: { items, editing, date, total, deposit, depositMethod, picker }
 * يعيد { head, newCustomer, deposit } أو يرمي خطأً مفهوماً.
 */
function readInvoiceForm({ items, editing, date, total, deposit, depositMethod, picker }) {
  if (!items.length) throw new Error('أضف بنداً واحداً على الأقل');
  if (!date.value) throw new Error('تاريخ الفاتورة مطلوب');
  const net = requiredMoney(total, 'الإجمالي');
  if (net <= 0) throw new Error('الإجمالي يجب أن يكون أكبر من صفر');
  const depositInfo = editing ? null : readDeposit(deposit, depositMethod, net);
  const { customerId, newCustomer } = picker.resolve();
  return { head: { customerId, invoiceDate: date.value, netContractPiastres: net }, newCustomer, deposit: depositInfo };
}

function readDeposit(input, methodSelect, net) {
  const amount = optionalMoney(input, 'العربون');
  if (amount > net) throw new Error('العربون لا يزيد عن الإجمالي');
  return amount > 0 ? { amountPiastres: amount, method: methodSelect.value } : null;
}

export {readInvoiceForm};
