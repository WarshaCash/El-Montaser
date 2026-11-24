// بيانات فاتورة تجريبية لطباعة «صفحة اختبار» تُظهر أثر الهوامش دون أي بيانات حقيقية.
export function sampleInvoiceData() {
  const today = new Date().toISOString().slice(0, 10);
  return {
    customer: { name: 'عميل تجريبي', phone: '01000000000' },
    invoice: { invoiceDate: today, netContractPiastres: 500000 },
    items: [
      { category: 'نوم', description: '', sizeText: '', qty: 1, unitPricePiastres: 500000, notes: '',
        lines: [
          { text: 'الاستايل: كلاسيك', size: '' },
          { text: 'دولاب (ضلفة)', size: '200 × 120 سم' },
          { text: 'سرير (ميكانيزم)', size: '160 × 200 سم' },
        ] },
      { category: 'مطبخ', description: '12 ضلفة', sizeText: '', qty: 1, unitPricePiastres: 0, notes: '' },
    ],
    payments: [{ status: 'active', amountPiastres: 100000, paidAt: today, method: 'نقدي' }],
  };
}
