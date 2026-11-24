import { int, rawNumber } from '../validation.js';

/** قسم بمقاس واحد بالسنتيمتر ضمن حدّين. */
export const sizeKind = {
  id: 'size',
  label: 'مقاس واحد بالسنتيمتر',
  createOrder: 2,
  summary: (c) => `${c.label || 'المقاس'}: من ${c.min} إلى ${c.max} سم`,
  normalize(def, raw) {
    const sizeCm = int(rawNumber(raw), def.min, def.max, def.label || 'القيمة');
    return { specs: { sizeCm }, description: '', sizeText: `${sizeCm} سم` };
  },
};
