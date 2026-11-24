export function el(t, props = {}, ...kids) { const e = Object.assign(document.createElement(t), props); e.append(...kids); return e; }
