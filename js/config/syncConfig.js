// ربط النظام بـ Google Sheets — يُضبط في الكود فقط (لا توجد أي شاشة أو حقل لذلك في النظام).
// يغيّره المبرمج هنا، أو يُحقن وقت البناء من متغيّري البيئة WORKSHOP_SYNC_URL وWORKSHOP_SYNC_TOKEN
// (في GitHub: Settings ▸ Secrets and variables ▸ Actions) فلا يُكتب الرمز في ملفات المستودع.
// تبقى القيمتان فارغتين = يعمل النظام محلياً على الجهاز بدون مزامنة.
export const SYNC_CONFIG = {
  scriptUrl: '',
  token: '',
};
