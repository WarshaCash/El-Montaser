import {el} from '../../../core/dom.js';

/** نطاق حقول القسم: حاوية + تسجيل الأجزاء الإلزامية + إبراز أول جزء ناقص عند الخطأ.
 *  كل نوع قسم يبني حقوله داخل هذا النطاق دون أن يعرف شيئاً عن باقي الشاشة. */
function createFieldScope(onchange) {
  const root = el('div', { className: 'fields2' });
  const required = [];

  /** يسجّل مجموعة إلزامية؛ missing() ترجع true إن كانت ناقصة. */
  const req = (group, missing) => {
    required.push({ group, missing });
    return group;
  };
  const clear = () => root.querySelectorAll('.bad').forEach((x) => x.classList.remove('bad'));
  const mark = () => {
    const first = required.find((r) => !r.group.hidden && !r.group.closest('[hidden]') && r.missing());
    const target = first ? first.group : root.querySelector('.big-in') || root;
    target.classList.add('bad');
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };
  const touched = () => { clear(); onchange(); };
  root.addEventListener('click', touched);
  root.addEventListener('input', touched);
  return { root, req, mark, onchange };
}

export {createFieldScope};
