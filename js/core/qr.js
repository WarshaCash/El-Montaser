// مولّد QR Code بلا مكتبات خارجية (وضع البايتات UTF-8، إصدارات 1–10، تصحيح L أو M).
const EXP = new Array(512), LOG = new Array(256);
(() => { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
const gmul = (a, b) => a && b ? EXP[LOG[a] + LOG[b]] : 0;
function rsRemainder(data, ec) {
  let gen = [1];
  for (let i = 0; i < ec; i++) { const next = new Array(gen.length + 1).fill(0); gen.forEach((c, j) => { next[j] ^= c; next[j + 1] ^= gmul(c, EXP[i]); }); gen = next; }
  const res = new Array(ec).fill(0);
  for (const b of data) { const f = b ^ res.shift(); res.push(0); if (f) for (let j = 0; j < ec; j++) res[j] ^= gmul(gen[j + 1], f); }
  return res;
}
// لكل إصدار: [عدد كلمات التصحيح لكل كتلة, [كتل المجموعة 1, بيانات الكتلة], [كتل المجموعة 2, بيانات الكتلة]]
const BLOCKS = {
  L: [null, [7, [1, 19]], [10, [1, 34]], [15, [1, 55]], [20, [1, 80]], [26, [1, 108]], [18, [2, 68]], [20, [2, 78]], [24, [2, 97]], [30, [2, 116]], [18, [2, 68], [2, 69]]],
  M: [null, [10, [1, 16]], [16, [1, 28]], [26, [1, 44]], [18, [2, 32]], [24, [2, 43]], [16, [4, 27]], [18, [4, 31]], [22, [2, 38], [2, 39]], [22, [3, 36], [2, 37]], [26, [4, 43], [1, 44]]],
};
const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
const bchDigit = d => { let n = 0; while (d) { n++; d >>>= 1; } return n; };
const bch = (data, g) => { let d = data << (bchDigit(g) - 1); while (bchDigit(d) >= bchDigit(g)) d ^= g << (bchDigit(d) - bchDigit(g)); return d; };
const MASKS = [(i, j) => (i + j) % 2 === 0, (i) => i % 2 === 0, (i, j) => j % 3 === 0, (i, j) => (i + j) % 3 === 0, (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0, (i, j) => (i * j) % 2 + (i * j) % 3 === 0, (i, j) => ((i * j) % 2 + (i * j) % 3) % 2 === 0, (i, j) => ((i * j) % 3 + (i + j) % 2) % 2 === 0];

function dataCodewords(bytes, ver, ecc) {
  const info = BLOCKS[ecc][ver], ec = info[0], groups = info.slice(1), total = groups.reduce((s, [n, d]) => s + n * d, 0), cb = ver < 10 ? 8 : 16;
  const bits = []; const put = (v, len) => { for (let i = len - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
  put(4, 4); put(bytes.length, cb); bytes.forEach(b => put(b, 8));
  for (let i = 0; i < 4 && bits.length < total * 8; i++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const cw = []; for (let i = 0; i < bits.length; i += 8) cw.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let p = 0; cw.length < total; p++) cw.push(p % 2 ? 0x11 : 0xec);
  const blocks = []; let pos = 0;
  for (const [n, d] of groups) for (let i = 0; i < n; i++) { const data = cw.slice(pos, pos + d); pos += d; blocks.push({ data, ec: rsRemainder(data, ec) }); }
  const out = [], maxD = Math.max(...groups.map(g => g[1]));
  for (let i = 0; i < maxD; i++) blocks.forEach(b => { if (i < b.data.length) out.push(b.data[i]); });
  for (let i = 0; i < ec; i++) blocks.forEach(b => out.push(b.ec[i]));
  return out;
}

function build(codewords, ver, ecc, mask) {
  const n = ver * 4 + 17, m = Array.from({ length: n }, () => new Array(n).fill(null));
  const finder = (r0, c0) => { for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) { const rr = r0 + r, cc = c0 + c; if (rr < 0 || rr >= n || cc < 0 || cc >= n) continue; m[rr][cc] = (r >= 0 && r <= 6 && (c === 0 || c === 6)) || (c >= 0 && c <= 6 && (r === 0 || r === 6)) || (r >= 2 && r <= 4 && c >= 2 && c <= 4); } };
  finder(0, 0); finder(n - 7, 0); finder(0, n - 7);
  const al = ALIGN[ver]; for (const r of al) for (const c of al) { if (m[r][c] !== null) continue; for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) m[r + i][c + j] = i === -2 || i === 2 || j === -2 || j === 2 || (!i && !j); }
  for (let i = 8; i < n - 8; i++) { if (m[i][6] === null) m[i][6] = i % 2 === 0; if (m[6][i] === null) m[6][i] = i % 2 === 0; }
  const fmt = ((((ecc === 'L' ? 1 : 0) << 3) | mask) << 10 | bch(((ecc === 'L' ? 1 : 0) << 3) | mask, 0x537)) ^ 0x5412;
  for (let i = 0; i < 15; i++) {
    const b = ((fmt >> i) & 1) === 1;
    if (i < 6) m[i][8] = b; else if (i < 8) m[i + 1][8] = b; else m[n - 15 + i][8] = b;
    if (i < 8) m[8][n - i - 1] = b; else if (i < 9) m[8][15 - i] = b; else m[8][14 - i] = b;
  }
  m[n - 8][8] = true;
  if (ver >= 7) { const v = (ver << 12) | bch(ver, 0x1f25); for (let i = 0; i < 18; i++) { const b = ((v >> i) & 1) === 1; m[Math.floor(i / 3)][i % 3 + n - 11] = b; m[i % 3 + n - 11][Math.floor(i / 3)] = b; } }
  let inc = -1, row = n - 1, bit = 7, byte = 0;
  for (let col = n - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (;;) {
      for (let c = 0; c < 2; c++) if (m[row][col - c] === null) { let dark = byte < codewords.length && ((codewords[byte] >>> bit) & 1) === 1; if (MASKS[mask](row, col - c)) dark = !dark; m[row][col - c] = dark; if (--bit < 0) { byte++; bit = 7; } }
      row += inc; if (row < 0 || row >= n) { row -= inc; inc = -inc; break; }
    }
  }
  return m;
}
function penalty(m) {
  const n = m.length; let p = 0;
  for (const get of [(a, b) => m[a][b], (a, b) => m[b][a]]) for (let a = 0; a < n; a++) {
    let run = 1; for (let b = 1; b < n; b++) { if (get(a, b) === get(a, b - 1)) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; }
    for (let b = 0; b + 10 < n; b++) { const s = []; for (let k = 0; k < 11; k++) s.push(get(a, b + k) ? 1 : 0); const t = s.join(''); if (t === '10111010000' || t === '00001011101') p += 40; }
  }
  for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) { const v = m[r][c]; if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) p += 3; }
  const dark = m.flat().filter(Boolean).length; p += Math.floor(Math.abs(dark * 100 / (n * n) - 50) / 5) * 10;
  return p;
}
/** يعيد مصفوفة منطقية [صف][عمود] (true = مربع داكن). يرمي خطأً عربياً إذا زاد النص عن السعة (حوالي 213 بايتاً). */
export function qrMatrix(text, ecc = 'M') {
  const bytes = Array.from(new TextEncoder().encode(String(text))); if (!bytes.length) throw new Error('نص QR فارغ');
  let ver = 0;
  for (let v = 1; v <= 10; v++) { const cap = BLOCKS[ecc][v].slice(1).reduce((s, [a, d]) => s + a * d, 0) * 8, need = 4 + (v < 10 ? 8 : 16) + bytes.length * 8; if (need <= cap) { ver = v; break; } }
  if (!ver) throw new Error('نص QR طويل جداً (الحد الأقصى نحو 210 حرفاً لاتينياً)');
  const cw = dataCodewords(bytes, ver, ecc); let best = null, bp = Infinity;
  for (let mask = 0; mask < 8; mask++) { const m = build(cw, ver, ecc, mask), p = penalty(m); if (p < bp) { bp = p; best = m; } }
  return best;
}
/** مسار SVG (وحدة = مربع واحد) لدمج الصفوف المتجاورة */
export function qrPath(m) {
  let d = ''; m.forEach((row, r) => { let c = 0; while (c < row.length) { if (!row[c]) { c++; continue; } let e = c; while (e < row.length && row[e]) e++; d += `M${c} ${r}h${e - c}v1h${c - e}z`; c = e; } });
  return d;
}
