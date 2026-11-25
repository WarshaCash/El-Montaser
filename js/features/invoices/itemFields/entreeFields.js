import {el} from '../../../core/dom.js';
import {chips, grp} from '../../../ui/controls.js';

/** الانتريه: اختيار 1 أو 2 كنبة و1 أو 2 كرسي، والترابيزة ثابتة. الافتراضي 2 + 2. */
function buildEntreeFields(def, scope) {
  const sofas = chips([['1', 'كنبة واحدة'], ['2', 'كنبتان']], { value: '2' });
  const chairs = chips([['1', 'كرسي واحد'], ['2', 'كرسيان']], { value: '2' });
  scope.root.append(
    scope.req(grp('عدد الكنب', sofas.root), () => !sofas.get()),
    scope.req(grp('عدد الكراسي', chairs.root), () => !chairs.get()),
    grp('الترابيزة', el('div', { className: 'note', textContent: 'ترابيزة (ثابتة)' })),
  );
  return () => ({ sofas: sofas.get(), chairs: chairs.get() });
}

export {buildEntreeFields};
