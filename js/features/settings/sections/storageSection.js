import {el} from '../../../core/dom.js';
import {settingsCard, actionButton} from './card.js';

const MB = 1048576;

function storageEstimate() {
  const line = el('p', { textContent: '…' });
  (async () => {
    const estimate = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
    const used = estimate && (estimate.usage / MB).toFixed(2);
    const quota = estimate && (estimate.quota / MB).toFixed(0);
    line.textContent = estimate ? `المستخدم تقريباً: ${used} م.ب من ${quota} م.ب` : '';
  })();
  return line;
}

function storageSection({ notice }) {
  const persist = actionButton('طلب تخزين دائم', async () => {
    const granted = navigator.storage?.persist ? await navigator.storage.persist() : false;
    notice.done(granted ? 'منح المتصفح التخزين الدائم' : 'لم يمنح المتصفح التخزين الدائم (القرار للمتصفح)');
  });
  return settingsCard('التخزين', storageEstimate(), persist);
}

export {storageSection};
