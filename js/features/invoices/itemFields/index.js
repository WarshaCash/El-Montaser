// سجل بُناة حقول الأقسام (واجهة). لإضافة نوع جديد: ملف builder جديد + سطر هنا + قاعدة تحقق في domain/catalog/kinds.
// عقد الباني:  (def, scope) → read()   حيث scope من createFieldScope، وread ترجع ما أدخله المستخدم.

import {getConfig} from '../../../domain/catalog/catalog.js';
import {createFieldScope} from './fieldScope.js';
import {buildNumberFields} from './numberFields.js';
import {buildEntreeFields} from './entreeFields.js';
import {buildFixedFields} from './fixedFields.js';
import {buildRoomFields} from './roomsFields.js';

const BUILDERS = {
  count: buildNumberFields,
  size: buildNumberFields,
  entree: buildEntreeFields,
  fixed: buildFixedFields,
  rooms: buildRoomFields,
  kids: buildRoomFields,
  includes: buildRoomFields,
};

/** حقول القسم المختار: أزرار واضحة بدل القوائم. يعيد { root, read, mark }. */
function fieldsFor(categoryName, onchange = () => {}) {
  const def = getConfig().categories.find((c) => c.name === categoryName) || {};
  const scope = createFieldScope(onchange);
  const build = BUILDERS[def.kind];
  const read = build ? build(def, scope) : () => ({});
  return { root: scope.root, read, mark: scope.mark };
}

export {fieldsFor};
