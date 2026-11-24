import { getKV } from '../../infrastructure/db/store.js';

/** تصميم الترويسة والتذييل في الفاتورة وقالب الورق الفارغ (قابل للتعديل من الإعدادات). */
export const DEFAULT_DESIGN = {
  name: 'المنتصر',
  sub: 'لتصنيع الموبيليا الحديثة والباب والشباك',
  tag: 'جودة .. أناقة .. تصاميم عصرية',
  walnut: '#241206',
  gold: '#F9C063',
  logo: '', // فارغ = الشعار الافتراضي assets/logo.webp
  signLabel: 'إمضاء العميل',
  admin: 'منتصر ابو عسس',
  phone: '01155589159',
  whatsapp: '',
  icons: { call: true, whatsapp: true, cash: false, instapay: false },
  wm: { on: true, opacity: 10, size: 70 }, // العلامة المائية: تفعيل، شفافية %، حجم % من عرض منطقة الجدول
};

export const ICON_LABELS = [['call', 'اتصال'], ['whatsapp', 'واتساب'], ['cash', 'فودافون كاش'], ['instapay', 'إنستاباي']];
export const isHex = (v) => /^#[0-9a-f]{6}$/i.test(v);

export async function getDesign() {
  const saved = await getKV('settings', 'sheetDesign', {});
  const design = { ...DEFAULT_DESIGN, ...saved };
  design.icons = { ...DEFAULT_DESIGN.icons, ...(saved.icons || {}) };
  design.wm = { ...DEFAULT_DESIGN.wm, ...(saved.wm || {}) };
  if (!isHex(design.walnut)) design.walnut = DEFAULT_DESIGN.walnut;
  if (!isHex(design.gold)) design.gold = DEFAULT_DESIGN.gold;
  return design;
}
