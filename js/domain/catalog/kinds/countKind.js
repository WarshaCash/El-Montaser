import {int, rawNumber} from '../validation.js';

/** قسم بعدد واحد (ضلف، كراسي…) ضمن حدّين. */
const countKind = {
  id: 'count',
  label: 'عدد (ضلف، كراسي…)',
  createOrder: 1,
  summary: (c) => `${c.label}: من ${c.min} إلى ${c.max}${c.unit ? ' ' + c.unit : ''}${c.input === 'typed' ? ' (يُكتب)' : ''}`,
  normalize(def, raw) {
    const value = int(rawNumber(raw), def.min, def.max, def.label || 'القيمة');
    return { specs: { value }, description: `${value} ${def.unit || ''}`.trim(), sizeText: '' };
  },
};

export {countKind};
