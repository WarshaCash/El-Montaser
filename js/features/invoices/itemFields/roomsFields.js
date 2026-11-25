import {el} from '../../../core/dom.js';
import {icon} from '../../../ui/ui.js';
import {btn, chips, grp, multiChips} from '../../../ui/controls.js';
import {getConfig} from '../../../domain/catalog/catalog.js';
import {BED, ROOM_INCLUDES, KID_INCLUDES, WARDROBE_TYPES} from '../../../domain/catalog/roomParts.js';

const CHECK_ICON = 'M5 12.5l4.5 4.5L19 7.5';

const includeList = (def) => {
  if (def.kind === 'rooms') return ROOM_INCLUDES;
  if (def.kind === 'kids') return KID_INCLUDES;
  return (def.includes || []).map((name) => [name, name]);
};

/** أسرّة الأطفال: عدد (1 أو 2) ونوع لكل سرير (يمكن اختيار أكثر من نوع للسرير الواحد). */
const MULTI = ' (يمكن اختيار أكثر من نوع)';
function kidsBedFields(body, scope) {
  const first = multiChips(BED);
  const firstGroup = scope.req(grp('نوع السرير 1' + MULTI, first.root), () => !first.get().length);
  const second = multiChips(BED);
  const secondGroup = scope.req(grp('نوع السرير 2' + MULTI, second.root), () => count.get() === '2' && !second.get().length);
  const count = chips(['1', '2'], {
    value: '2',
    onchange: (v) => {
      secondGroup.hidden = v !== '2';
      if (secondGroup.hidden) second.set([]);
      firstGroup.firstChild.textContent = (v === '2' ? 'نوع السرير 1' : 'نوع السرير') + MULTI;
    },
  });
  body.append(grp('عدد الأسرّة', count.root), firstGroup, secondGroup);
  return () => ({ types: [first.get(), second.get()], count: count.get() });
}

/** سرير غرفة النوم: يمكن اختيار أكثر من نوع (ميكانيزم، سحارة، ملل). */
function bedFields(body, scope) {
  const types = multiChips(BED);
  body.append(scope.req(grp('نوع السرير' + MULTI, types.root), () => !types.get().length));
  return () => ({ types: types.get() });
}

function commodeFields(body, scope) {
  const count = chips(['1', '2']);
  body.append(scope.req(grp('عدد الكومودينو', count.root), () => !count.get()));
  return () => ({ count: count.get() });
}

/** نوع/عدد خاص بمشتمل معيّن (يعيد دالة قراءة أو null). */
function specificFields(key, { isKids, isCustom }, body, scope, wardrobe) {
  if (isCustom) return null;
  if (key === 'wardrobe') { body.append(scope.req(grp('نوع الدولاب', wardrobe.root), () => !wardrobe.get())); return null; }
  if (key === 'bed') return isKids ? kidsBedFields(body, scope) : bedFields(body, scope);
  if (key === 'commode' && !isKids) return commodeFields(body, scope);
  return null;
}

/** مشتمل واحد قابل للتحديد بنقرة، تظهر تفاصيله تحته فقط عند تحديده. */
function buildPick(key, name, mode, scope, wardrobe) {
  const body = el('div', { className: 'pick-body', hidden: true });
  const pick = el('div', { className: 'pick' });
  const state = { selected: false, read: () => ({}), setOn: () => {} };
  const head = btn('pick-head', [el('span', { className: 'tick' }, icon(CHECK_ICON)), el('span', { className: 'pn', textContent: name })],
    () => state.setOn(!state.selected), { role: 'checkbox', 'aria-checked': 'false' });
  state.setOn = (on) => {
    state.selected = on;
    pick.classList.toggle('on', on);
    body.hidden = !on;
    head.setAttribute('aria-checked', String(on));
    scope.onchange();
  };
  const readSpecific = specificFields(key, mode, body, scope, wardrobe);
  body.append(el('div', { className: 'pick-row' }, ...body.childNodes));
  state.read = () => (readSpecific ? readSpecific() : {});
  pick.append(head, body);
  return { pick, state };
}

/** نوم / أطفال / مشتملات مخصصة: استايل (إن لزم) + اختيار المشتملات. */
function buildRoomFields(def, scope) {
  const config = getConfig();
  const isKids = def.kind === 'kids';
  const isCustom = def.kind === 'includes';
  const asksStyle = !isKids && (!isCustom || def.usesStyle);
  const style = asksStyle ? chips(config.styles) : null;
  const wardrobe = chips(WARDROBE_TYPES);

  if (isKids) scope.root.append(grp('الاستايل', el('div', { className: 'note', textContent: 'مودرن' })));
  else if (style) scope.root.append(scope.req(grp('الاستايل', style.root), () => !style.get()));

  const picks = el('div', { className: 'picks' });
  const states = {};
  for (const [key, name] of includeList(def)) {
    const { pick, state } = buildPick(key, name, { isKids, isCustom }, scope, wardrobe);
    states[key] = state;
    picks.append(pick);
  }
  const all = btn('mini-link', 'تحديد الكل', () => Object.values(states).forEach((s) => s.setOn(true)));
  const none = btn('mini-link', 'مسح', () => Object.values(states).forEach((s) => s.setOn(false)));
  const title = el('div', { className: 'grp-t' }, el('span', { textContent: 'المشتملات — اضغط على كل قطعة مطلوبة' }), el('span', { className: 'grp-tools' }, all, none));
  scope.root.append(scope.req(el('div', { className: 'grp' }, title, picks), () => !Object.values(states).some((s) => s.selected)));

  return () => ({
    style: isKids ? 'مودرن' : style ? style.get() : '',
    wardrobeType: wardrobe.get(),
    includes: Object.fromEntries(Object.entries(states).filter(([, s]) => s.selected).map(([key, s]) => [key, s.read()])),
  });
}

export {buildRoomFields};
