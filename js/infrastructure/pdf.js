const enc = new TextEncoder();
/** كاتب PDF بسيط: كل صفحة A4 تحمل صورة JPEG بملء الصفحة (595.28 × 841.89 نقطة). */
function pdfFromJpegs(pages) {
  const parts = [], offs = []; let len = 0;
  const push = x => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
  const begin = n => { offs[n] = len; push(`${n} 0 obj\n`); };
  push('%PDF-1.4\n'); push(new Uint8Array([0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A]));
  begin(1); push('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  begin(2); push(`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${3 + 3 * i} 0 R`).join(' ')}] >>\nendobj\n`);
  pages.forEach((p, i) => {
    const pg = 3 + 3 * i, ct = pg + 1, im = pg + 2, pw = p.pw || 595.28, ph = p.ph || 841.89, content = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`; // pw/ph بالنقطة لمقاسات الورق غير A4
    begin(pg); push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 ${im} 0 R >> >> /Contents ${ct} 0 R >>\nendobj\n`);
    begin(ct); push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);
    begin(im); push(`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.data.length} >>\nstream\n`); push(p.data); push('\nendstream\nendobj\n');
  });
  const n = 3 * pages.length + 3, xref = len;
  push(`xref\n0 ${n}\n0000000000 65535 f \n`);
  for (let i = 1; i < n; i++) push(`${String(offs[i]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${n} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(len); let o = 0; for (const b of parts) { out.set(b, o); o += b.length; } return out;
}

export {pdfFromJpegs};
