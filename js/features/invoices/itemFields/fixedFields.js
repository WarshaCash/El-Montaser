import { el } from '../../../core/dom.js';
import { grp } from '../../../ui/controls.js';

/** نص ثابت: يُعرض فقط ولا يحتاج إدخالاً. */
export function buildFixedFields(def, scope) {
  scope.root.append(grp('المشتملات (ثابتة)', el('div', { className: 'note', textContent: def.text || '' })));
  return () => ({});
}
