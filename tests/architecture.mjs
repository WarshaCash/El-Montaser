// حارس المعمارية: يفرض قواعد الطبقات ويمنع الدوائر ويكشف أي ارتباط جديد بين الميزات.
// التشغيل:  node tests/architecture.mjs      (لا يحتاج أي حزم)
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const JS = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'js');

/** الطبقة المسموح لها بالاستيراد منها (اتجاه واحد فقط: من الأعلى إلى الأسفل). */
const ALLOWED = {
  config: [], // إعدادات ثابتة يكتبها المبرمج (مثل رابط المزامنة): ورقة لا تستورد شيئاً
  core: ['core'],
  domain: ['core', 'domain'],
  infrastructure: ['config', 'core', 'domain', 'infrastructure'],
  ui: ['core', 'ui'],
  features: ['core', 'domain', 'infrastructure', 'ui', 'features', 'shell'],
  shell: ['core', 'domain', 'infrastructure', 'ui', 'features', 'shell'], // app.js ومجلد shell/ (التوجيه والسجل والإطار)
};
/** ارتباطات الميزات القائمة اليوم (ميزة ← ميزة). أي ارتباط جديد خارج هذه القائمة يفشل الاختبار ويستلزم قراراً واعياً. */
const KNOWN_FEATURE_LINKS = new Set([
  'archive->invoices', 'customers->quickAccess', 'finance->invoices', 'finance->quickAccess',
  'invoices->archive', 'invoices->quickAccess', 'printing->archive', 'settings->invoices',
]);

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith('.js') && name !== 'bundle.js') files.push(p);
  }
})(JS);

const rel = (p) => relative(JS, p).split('\\').join('/');
const layerOf = (r) => (r === 'app.js' || r.startsWith('shell/') ? 'shell' : r.split('/')[0]);
const featureOf = (r) => (r.startsWith('features/') ? r.split('/')[1] : null);

const graph = new Map();
const problems = [];
for (const file of files) {
  const from = rel(file);
  const deps = [];
  for (const [, spec] of readFileSync(file, 'utf8').matchAll(/from\s*'([^']+)'/g)) {
    if (!spec.startsWith('.')) continue;
    const target = normalize(join(dirname(file), spec));
    if (!existsSync(target)) { problems.push(`${from}: الاستيراد '${spec}' يشير إلى ملف غير موجود`); continue; }
    const to = rel(target);
    deps.push(to);
    const fl = layerOf(from), tl = layerOf(to);
    if (!ALLOWED[fl]) problems.push(`${from}: طبقة غير معروفة '${fl}'`);
    else if (!ALLOWED[fl].includes(tl)) problems.push(`${from} (${fl}) لا يجوز أن يستورد ${to} (${tl})`);
    const ff = featureOf(from), tf = featureOf(to);
    if (ff && tf && ff !== tf && !KNOWN_FEATURE_LINKS.has(`${ff}->${tf}`)) problems.push(`ارتباط جديد بين ميزتين: ${ff} → ${tf} (${from} يستورد ${to}). انقل المشترك إلى طبقة أدنى أو سجّل الارتباط عمداً.`);
  }
  graph.set(from, deps);
}

// دوائر الاستيراد على مستوى الوحدات
const state = new Map();
(function dfs(node, stack) {
  if (state.get(node) === 'done') return;
  if (state.get(node) === 'busy') { problems.push('دائرة استيراد: ' + [...stack.slice(stack.indexOf(node)), node].join(' → ')); return; }
  state.set(node, 'busy');
  for (const d of graph.get(node) || []) dfs(d, [...stack, node]);
  state.set(node, 'done');
})('app.js', []);

// فرض: الطبقة domain نقية (بلا DOM ولا IndexedDB)
for (const file of files.filter((f) => rel(f).startsWith('domain/'))) {
  const src = readFileSync(file, 'utf8');
  if (/\b(document|window|indexedDB|localStorage)\b/.test(src)) problems.push(`${rel(file)}: طبقة domain يجب أن تبقى نقية (لا document/window/indexedDB)`);
}

// سقف «الدين الفني»: عدد الأسطر الأطول من 140 حرفاً في كل ملف لا يجوز أن يزيد عن خط الأساس المسجّل،
// وأي ملف جديد يجب أن يكون نظيفاً تماماً. عند تقليص الدين شغّل:  node tests/architecture.mjs --update-baseline
const MAX_LINE = 140;
const BASELINE_FILE = join(dirname(fileURLToPath(import.meta.url)), 'line-length-baseline.json');
const longLines = {};
for (const file of files) {
  const n = readFileSync(file, 'utf8').split('\n').filter((l) => l.length > MAX_LINE).length;
  if (n) longLines[rel(file)] = n;
}
if (process.argv.includes('--update-baseline')) {
  writeFileSync(BASELINE_FILE, JSON.stringify(Object.fromEntries(Object.entries(longLines).sort()), null, 2) + '\n');
  console.log('تم تحديث خط الأساس لطول الأسطر');
  process.exit(0);
}
const baseline = existsSync(BASELINE_FILE) ? JSON.parse(readFileSync(BASELINE_FILE, 'utf8')) : {};
for (const [file, n] of Object.entries(longLines)) {
  if (n > (baseline[file] ?? 0)) problems.push(`${file}: ${n} سطراً أطول من ${MAX_LINE} حرفاً (المسموح ${baseline[file] ?? 0}). قسّم السطر أو الدالة.`);
}
const improved = Object.entries(baseline).filter(([f, n]) => (longLines[f] ?? 0) < n);
const debtLines = Object.values(longLines).reduce((a, b) => a + b, 0);

if (problems.length) {
  problems.forEach((p) => console.log('FAIL', p));
  console.log(`\n${problems.length} مخالفة معمارية`);
  process.exit(1);
}
console.log(`PASS المعمارية سليمة: ${files.length} وحدة، لا دوائر، واتجاه الاعتماد صحيح (دين الأسطر الطويلة المتبقي: ${debtLines})`);
if (improved.length) console.log(`ملاحظة: تحسّن ${improved.length} ملف عن خط الأساس؛ ثبّت التحسن بـ  node tests/architecture.mjs --update-baseline`);
