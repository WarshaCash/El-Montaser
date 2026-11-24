// نقطة بدء التطبيق: تجمع الميزات المسجّلة وتشغّل الإطار. لا منطق عمل هنا.
// لإضافة ميزة جديدة: أنشئ features/<n>/feature.js وسجّلها في shell/registry.js.
import { FEATURES } from './shell/registry.js';
import { registerFeatures, buildNav, navigate } from './shell/router.js';
import { initChrome } from './shell/chrome.js';
import { showBackupReminder } from './shell/backupReminder.js';
import { bootSync } from './shell/syncUi.js';
import { initMobileNav } from './shell/mobileNav.js';
import { initResponsiveTables } from './shell/responsiveTables.js';
import { initSheetFit } from './shell/sheetFit.js';
import { initTouchEnhance } from './shell/touchEnhance.js';
import { registerServiceWorker } from './shell/pwa.js';

async function main() {
  registerFeatures(FEATURES);
  initChrome();
  initMobileNav();
  initResponsiveTables(document.getElementById('view'));
  initSheetFit(document.getElementById('view'));
  initTouchEnhance(document.getElementById('view'));
  registerServiceWorker();
  buildNav(document.getElementById('nav'));
  await bootSync(); // وضع محلي، أو شاشة دخول لجهاز جديد، ثم بدء المزامنة
  FEATURES.forEach((feature) => feature.onStart?.());
  addEventListener('hashchange', navigate);
  navigate();
  showBackupReminder();
}
main();
