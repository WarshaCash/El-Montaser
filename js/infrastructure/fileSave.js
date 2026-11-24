// حفظ ملف للمستخدم بأمان: نافذة «حفظ باسم» المباشرة في Chrome/Edge (لا تمر بمدير التنزيلات فلا «فشل»)،
// وعند عدم توفرها أو تعذّر الكتابة تنزيل عادي برابط لا يُلغى قبل أن يبدأ المتصفح بقراءته.
const REVOKE_AFTER_MS = 10 * 60 * 1000; // إلغاء الرابط مبكراً يُفشل التنزيل إن انتظر المستخدم نافذة الحفظ

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
}

/**
 * يطلب مكان الحفظ أولاً (قبل أي انتظار، لتبقى صلاحية نقرة المستخدم سارية)، ثم يبني المحتوى ويكتبه.
 * build(): يعيد Blob. يرمي «أُلغي حفظ الملف» إن أغلق المستخدم النافذة.
 */
export async function saveBlobAs({ name, type, extension, build }) {
  let handle = null;
  if (typeof window.showSaveFilePicker === 'function') {
    try {
      const types = [{ description: name, accept: { [type]: [`.${extension}`] } }];
      handle = await window.showSaveFilePicker({ suggestedName: name, types });
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('أُلغي حفظ الملف');
      handle = null; // أي سبب آخر (سياق غير آمن، لا صلاحية): ننزّل بالطريقة العادية
    }
  }
  const blob = await build();
  if (handle) {
    try {
      const writer = await handle.createWritable();
      await writer.write(blob);
      await writer.close();
      return { name: handle.name, method: 'picker' };
    } catch { /* تعذّرت الكتابة في المكان المختار: ننزّل بالطريقة العادية */ }
  }
  downloadBlob(blob, name);
  return { name, method: 'download' };
}
