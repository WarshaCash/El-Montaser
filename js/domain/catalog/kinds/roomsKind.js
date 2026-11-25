import {int} from '../validation.js';
import {BED, ROOM_INCLUDES, KID_INCLUDES, WARDROBE_TYPES} from '../roomParts.js';

const KIDS_STYLE = 'مودرن';

/** قائمة المشتملات [مفتاح، اسم] حسب نوع القسم. */
function includeList(def) {
  if (def.kind === 'rooms') return ROOM_INCLUDES;
  if (def.kind === 'kids') return KID_INCLUDES;
  return (def.includes || []).map((name) => [name, name]);
}

/** الاستايل: غرف النوم تطلبه، الأطفال مودرن دائماً، والمشتملات المخصصة حسب إعداد القسم. */
function resolveStyle(def, raw, styles) {
  const isKids = def.kind === 'kids';
  const isCustom = def.kind === 'includes';
  const asksStyle = isCustom ? !!def.usesStyle : !isKids;
  const style = isKids ? KIDS_STYLE : asksStyle ? raw.style : null;
  if (asksStyle && !styles.includes(style)) throw new Error('اختر الاستايل');
  return style;
}

// ---- قواعد خاصة بمشتمل معيّن (تنطبق على النوم والأطفال فقط، لا على المشتملات المخصصة) ----
const wardrobeRule = (raw) => {
  if (!WARDROBE_TYPES.includes(raw.wardrobeType)) throw new Error('اختر نوع الدولاب');
  return { spec: { type: raw.wardrobeType }, suffix: ` (${raw.wardrobeType})` };
};

/** أنواع السرير المختارة (نص قديم أو قائمة) بترتيب BED وبلا تكرار؛ القيم غير المعروفة ترمي خطأً. */
function bedTypes(raw, message) {
  const list = [].concat(raw ?? []).filter(Boolean);
  if (!list.length || list.some((t) => !BED.includes(t))) throw new Error(message);
  return BED.filter((t) => list.includes(t));
}

function kidsBedRule(value) {
  const count = int(value.count || 2, 1, 2, 'عدد الأسرّة');
  const raw = (value.types || []).slice(0, count);
  const message = count === 1 ? 'اختر نوع السرير' : 'اختر نوع كل سرير من السريرين';
  if (raw.length !== count) throw new Error(message);
  const types = raw.map((t) => bedTypes(t, message));
  const joined = types.map((t) => t.join(' + '));
  const label = count === 1 ? `سرير (${joined[0]})` : `2 سرير (${joined.join('، ')})`;
  return { spec: { count, types: types.map((t) => (t.length === 1 ? t[0] : t)) }, label };
}

function bedRule(value, isKids) {
  if (isKids) return kidsBedRule(value);
  const types = bedTypes(value.types ?? value.type, 'اختر نوع السرير');
  return { spec: { type: types[0], types }, suffix: ` (${types.join('، ')})` };
}

const commodeRule = (value) => {
  const count = int(value.count, 1, 2, 'عدد الكومودينو');
  return { spec: { count }, suffix: ` × ${count}` };
};

/** يطبّق قاعدة المشتمل الخاصة إن وُجدت ويعيد { spec, label }. */
function applyIncludeRule(key, name, value, raw, def) {
  const isKids = def.kind === 'kids';
  let rule = null;
  if (def.kind !== 'includes') {
    if (key === 'wardrobe') rule = wardrobeRule(raw);
    else if (key === 'bed') rule = bedRule(value, isKids);
    else if (key === 'commode' && !isKids) rule = commodeRule(value);
  }
  if (!rule) return { spec: {}, label: name };
  return { spec: rule.spec, label: rule.label ?? name + (rule.suffix || '') };
}

function normalizeRoom(def, raw, { styles }) {
  const list = includeList(def);
  const names = Object.fromEntries(list);
  const style = resolveStyle(def, raw, styles);
  const chosen = raw.includes || {};
  const keys = list.map(([key]) => key).filter((key) => chosen[key]);
  if (!keys.length) throw new Error('اختر مشتملاً واحداً على الأقل');

  const includes = {};
  const parts = [];
  const lines = [];
  if (style) {
    parts.push(`الاستايل: ${style}`);
    lines.push({ text: `الاستايل: ${style}`, size: '' });
  }
  for (const key of keys) {
    const value = chosen[key];
    const { spec, label } = applyIncludeRule(key, names[key], value, raw, def);
    includes[key] = spec;
    parts.push(label);
    lines.push({ text: label, size: '' });
  }
  return {
    specs: { style, wardrobeType: raw.wardrobeType || null, includes },
    description: parts.join('\n'),
    sizeText: '',
    lines,
  };
}

/** ثلاثة أنواع تشترك في نفس المنطق: النوم، الأطفال، والمشتملات المخصصة. */
const roomsKind = {
  id: 'rooms', normalize: normalizeRoom,
  label: 'غرفة نوم (مشتملات ثابتة)',
  summary: () => 'استايل + مشتملات ثابتة',
};
const kidsKind = {
  id: 'kids', normalize: normalizeRoom,
  label: 'غرفة أطفال (مشتملات ثابتة)',
  summary: () => 'مشتملات ثابتة (استايل مودرن)',
};
const includesKind = {
  id: 'includes', normalize: normalizeRoom,
  label: 'مشتملات (مثل غرفة النوم)',
  createOrder: 5,
  summary: (c) => `${(c.includes || []).length} مشتملات${c.usesStyle ? ' + استايل' : ''}`,
};

export {roomsKind, kidsKind, includesKind};
