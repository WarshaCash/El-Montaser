// سجل الصنايعية (الاسم والورشة والحرفة): يُحفظ ضمن الإعدادات فيدخل في النسخ الاحتياطي والاستعادة تلقائياً.

import {getKV, setKV} from '../db/store.js';
import {stamp} from '../db/records.js';
import {cleanWorker} from '../../domain/expenses.js';

const KEY = 'workers';
const byName = (a, b) => a.name.localeCompare(b.name, 'ar');

const listWorkers = async () => [...(await getKV('settings', KEY, []))].sort(byName);

async function addWorker(input) {
  const all = await getKV('settings', KEY, []);
  const worker = stamp({ ...cleanWorker(input, all), active: true });
  await setKV('settings', KEY, [...all, worker]);
  return worker;
}

/** إيقاف صنايعي (لا يظهر في قائمة الصرف) أو إعادة تفعيله؛ لا يُحذف لتبقى مصروفاته السابقة بأسمه. */
async function setWorkerActive(id, active) {
  const all = await getKV('settings', KEY, []);
  if (!all.some((x) => x.id === id)) throw new Error('الصنايعي غير موجود');
  await setKV('settings', KEY, all.map((x) => (x.id === id ? { ...x, active: !!active } : x)));
}

export {listWorkers, addWorker, setWorkerActive};
