/** قسم بنص ثابت لا يحتاج أي إدخال. */
export const fixedKind = {
  id: 'fixed',
  label: 'نص ثابت (يُطبع كما هو)',
  createOrder: 3,
  summary: (c) => c.text,
  normalize(def) {
    return { specs: { text: def.text }, description: def.text || '', sizeText: '' };
  },
};
