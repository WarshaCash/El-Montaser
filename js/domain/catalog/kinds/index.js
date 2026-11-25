// سجل أنواع الأقسام (Strategy/Registry). لإضافة نوع جديد: أنشئ ملف <name>Kind.js وسجّله هنا فقط.
// عقد النوع:  { id, label, summary(def), createOrder?, normalize(def, raw, ctx) → { specs, description, sizeText, lines? } }
//   label/summary: وصفه في شاشة الأقسام. createOrder: إن وُجد صار النوع قابلاً للإنشاء من تلك الشاشة بهذا الترتيب.
//   def = تعريف القسم المحفوظ، raw = ما أدخله المستخدم، ctx = { styles }.

import {countKind} from './countKind.js';
import {sizeKind} from './sizeKind.js';
import {fixedKind} from './fixedKind.js';
import {entreeKind} from './entreeKind.js';
import {roomsKind, kidsKind, includesKind} from './roomsKind.js';

const REGISTRY = new Map(
  [roomsKind, kidsKind, includesKind, countKind, sizeKind, entreeKind, fixedKind].map((kind) => [kind.id, kind]),
);

const getKind = (id) => REGISTRY.get(id) || null;
const kindIds = () => [...REGISTRY.keys()];
/** الأنواع التي يمكن إنشاء قسم منها من شاشة الأقسام، بترتيبها. */
const creatableKinds = () => [...REGISTRY.values()].filter((k) => k.createOrder).sort((a, b) => a.createOrder - b.createOrder);
/** نص وصف نوع القسم (أو معرّفه إن كان غير معروف). */
const kindLabel = (id) => getKind(id)?.label || id;
/** سطر القواعد المعروض لقسم في قائمة الأقسام. */
const categorySummary = (def) => getKind(def.kind)?.summary?.(def) || '';

export {getKind, kindIds, creatableKinds, kindLabel, categorySummary};
