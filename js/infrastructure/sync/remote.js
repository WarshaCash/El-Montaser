// الاتصال بـ Google Apps Script. طلب POST بنوع text/plain (طلب «بسيط» فلا يحتاج preflight في CORS).

import {syncConfig} from './state.js';

const TIMEOUT_MS = 45000;

/** code: network | auth | locked | busy | not_configured | bad_request | server */
class RemoteError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

async function call(action, payload = {}) {
  const { url, token, deviceId } = syncConfig();
  if (!url) throw new RemoteError('not_configured', 'رابط السكربت غير مضبوط');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response;
  try {
    response = await fetch(url, {
      method: 'POST', redirect: 'follow', signal: controller.signal,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token, dev: deviceId, ...payload }),
    });
  } catch {
    throw new RemoteError('network', 'تعذّر الاتصال بالإنترنت أو بالسكربت');
  } finally {
    clearTimeout(timer);
  }
  let data;
  try { data = await response.json(); } catch {
    throw new RemoteError('server', 'رد غير مفهوم: تأكد من رابط السكربت وأن النشر «أي شخص» (Anyone)');
  }
  if (!data.ok) throw new RemoteError(data.code || 'server', data.message || 'خطأ من الخادم');
  return data;
}

export {RemoteError, call};
