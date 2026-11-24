import { el } from '../../../core/dom.js';
import { chips, stepper, suffix, grp } from '../../../ui/controls.js';

const MAX_CHIP_RANGE = 11;

/** قسم «عدد»: أزرار لو المدى صغير (إلا إن اختير الإدخال بالكتابة)، وإلا عدّاد قابل للكتابة. قسم «مقاس»: حقل رقمي بوحدة سم. */
export function buildNumberFields(def, scope) {
  const range = `من ${def.min} إلى ${def.max}`;
  if (def.kind === 'count' && def.input !== 'typed' && def.max - def.min <= MAX_CHIP_RANGE) {
    const options = Array.from({ length: def.max - def.min + 1 }, (_, i) => String(def.min + i));
    const picker = chips(options);
    const title = `${def.label || 'العدد'}${def.unit ? ` (${def.unit})` : ''}`;
    scope.root.append(scope.req(grp(title, picker.root), () => !picker.get()));
    return () => ({ value: picker.get() });
  }
  const input = el('input', { type: 'number', className: 'big-in', min: def.min, max: def.max, step: 1, inputMode: 'numeric', placeholder: String(def.min) });
  const control = def.kind === 'count' ? stepper(input, def.min, def.max) : suffix(input, 'سم');
  scope.root.append(scope.req(grp(def.label || 'القيمة', control, range), () => input.value === ''));
  return () => ({ value: input.value });
}
