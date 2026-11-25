// شاشة الإعدادات: قائمة أقسام مستقلة. لإضافة قسم جديد اكتب ملفاً في sections/ وأضفه إلى SECTIONS.

import {el} from '../../core/dom.js';
import {createBackupSession, createNotice} from './backupSession.js';
import {backupSection} from './sections/backupSection.js';
import {folderBackupSection} from './sections/folderBackupSection.js';
import {printLayoutSection} from './sections/printLayoutSection.js';
import {printOptionsSection} from './sections/printOptionsSection.js';
import {sheetDesignSection} from './sections/sheetDesignSection.js';
import {priceClauseSection} from './sections/priceClauseSection.js';
import {storageSection} from './sections/storageSection.js';

/** كل قسم دالة (ctx) ← عقدة أو مصفوفة عقد، بالترتيب الظاهر في الشاشة. ctx = { notice, session }. */
const SECTIONS = [
  backupSection, folderBackupSection, printLayoutSection,
  sheetDesignSection, printOptionsSection, priceClauseSection, storageSection,
];

async function renderSettings(view) {
  const ctx = { notice: createNotice(el), session: createBackupSession() };
  for (const build of SECTIONS) view.append(...[].concat(await build(ctx)));
}

export {renderSettings};
