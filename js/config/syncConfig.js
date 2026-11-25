// ربط النظام بـ Google Sheets — يُضبط في الكود فقط (لا توجد أي شاشة أو حقل لذلك في النظام).
// يغيّره المبرمج هنا، أو يُحقن وقت البناء من متغيّري البيئة WORKSHOP_SYNC_URL وWORKSHOP_SYNC_TOKEN
// (في GitHub: Settings ▸ Secrets and variables ▸ Actions) فلا يُكتب الرمز في ملفات المستودع.
// تبقى القيمتان فارغتين = يعمل النظام محلياً على الجهاز بدون مزامنة.

const SYNC_CONFIG = {
  scriptUrl: 'https://script.google.com/macros/s/AKfycbweS2LLG7wys3ZEe7tYLAJ4Da1ky0nrwyMb7fS40KMT-9kQiie7HKwPQ9zuYuMDBWhbKQ/exec',
  token: '98a4d71598bb41e4b4716fd64e73997e0b05ee012450',
};

export {SYNC_CONFIG};
