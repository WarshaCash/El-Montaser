// قطع غرف النوم والأطفال وأنواع الأسرّة (بيانات ثابتة يستخدمها منطق التحقق والواجهة).

const BED = ['ميكانيزم', 'سحارة', 'ملل'];
const ROOM_INCLUDES = [
  ['wardrobe', 'دولاب'], ['bed', 'سرير'], ['dresser', 'تسريحة'], ['commode', 'كومودينو'],
  ['bench', 'بانكيت'], ['chair', 'كرسي تسريحة'], ['hanger', 'شماعة'], ['chaise', 'شزلونج'],
];
const KID_INCLUDES = [
  ['wardrobe', 'دولاب'], ['bed', 'سرير'], ['commode', 'كومودينو'],
  ['dresser', 'تسريحة'], ['chair', 'كرسي تسريحة'],
];
const WARDROBE_TYPES = ['ضلفة', 'جرار'];

export {BED, ROOM_INCLUDES, KID_INCLUDES, WARDROBE_TYPES};
