/**
 * حالة جلسة النسخ الاحتياطي المشتركة بين أقسام الشاشة: لا تُفعَّل الاستعادة قبل أن يُنشأ المستخدم نسخة
 * حالية في هذه الجلسة، وكل قسم نسخ يُعلن إنجازه فتتحدّث بقية الأقسام (آخر نسخة، زر الاستعادة).
 */
function createBackupSession() {
  const listeners = [];
  let done = false;
  return {
    get done() { return done; },
    onChange(listener) { listeners.push(listener); },
    async markDone() {
      done = true;
      for (const listener of listeners) await listener();
    },
  };
}

/** منطقة الرسائل المشتركة: خطأ (أحمر) ونجاح. تُنشأ مرة واحدة وتُمرَّر لكل الأقسام. */
function createNotice(el) {
  const error = el('div', { className: 'err' });
  const success = el('div', {});
  return {
    error, success,
    fail(text) { error.textContent = text; },
    clearError() { error.textContent = ''; },
    done(text) { success.textContent = text; },
  };
}

export {createBackupSession, createNotice};
