// القيم الافتراضية للأقسام والاستايلات. قابلة للتعديل من شاشة «الأقسام والاستايلات» وتُحفظ في الإعدادات.
// kind يحدد قاعدة التحقق (input:'typed' في قسم العدد = حقل يُكتب فيه الرقم بدل أزرار الاختيار) (انظر kinds/): rooms|kids|includes (مشتملات) — count (عدد) — size (مقاس واحد)
//   — entree (انتريه: 1 أو 2 كنبة + 1 أو 2 كرسي + ترابيزة) — fixed (نص ثابت).
export const DEFAULT_STYLES = ['مودرن', 'كلاسيك', 'نوم مقبض', 'أولومبيات', 'مروحة', 'استانلس'];

export const DEFAULT_CATEGORIES = [
  { id: 'bedroom', name: 'نوم', kind: 'rooms' },
  { id: 'kids', name: 'أطفال', kind: 'kids' },
  { id: 'kitchen', name: 'مطبخ', kind: 'count', label: 'عدد الضلف', min: 1, max: 100, unit: 'ضلفة' },
  { id: 'corner', name: 'ركنية', kind: 'size', label: 'المقاس (سم)', min: 1, max: 2000 },
  { id: 'tvunit', name: 'مكتبة شاشة', kind: 'size', label: 'المقاس (سم)', min: 120, max: 250 },
  { id: 'jazama', name: 'جزامة', kind: 'size', label: 'المقاس (سم)', min: 50, max: 150 },
  { id: 'entree', name: 'انتريه', kind: 'entree' },
  { id: 'dining', name: 'سفرة', kind: 'count', label: 'عدد الكراسي', min: 2, max: 10, unit: 'كراسي', input: 'typed' },
  { id: 'dinsoir', name: 'دنسوار', kind: 'size', label: 'المقاس (سم)', min: 200, max: 500 },
  { id: 'niche', name: 'نيش', kind: 'count', label: 'عدد الضلف', min: 1, max: 4, unit: 'ضلفة' },
];
