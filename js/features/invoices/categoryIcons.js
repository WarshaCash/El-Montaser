// أيقونات الأقسام (خطوط بسيطة بنفس أسلوب أيقونات القائمة). الأقسام المضافة لاحقاً تأخذ أيقونة عامة.

const CAT_ICONS = {
  bedroom: 'M3 19v-8a2 2 0 012-2h14a2 2 0 012 2v8M3 15h18M7 9V7a1 1 0 011-1h3a1 1 0 011 1v2M13 9V7a1 1 0 011-1h3a1 1 0 011 1v2',
  kids: 'M5 3v18M19 3v18M5 8h14M5 15h14M8 6h3M8 13h3',
  kitchen: 'M4 4h16v16H4zM12 4v16M4 10h16M9 7v.5M15 7v.5M9 14v2M15 14v2',
  corner: 'M3 9h12v4h6v7H3zM3 13h12',
  tvunit: 'M3 5h18v11H3zM8 20h8M12 16v4',
  jazama: 'M5 3h14v18H5zM5 9h14M5 15h14M10 6h4M10 12h4M10 18h4',
  entree: 'M5 11V8a2 2 0 012-2h10a2 2 0 012 2v3M3 13a2 2 0 014 0v2h10v-2a2 2 0 014 0v5H3zM6 20v1M18 20v1',
  dining: 'M3 5h18M5 5l1 14M19 5l-1 14M8 12h8',
  dinsoir: 'M5 3h14v18H5zM12 3v18M9 12v1.5M15 12v1.5',
  niche: 'M6 3h12l1 5v13H5V8zM5 8h14M12 8v13M9 14v2M15 14v2',
};
const CAT_FALLBACK = 'M4 7l8-4 8 4v10l-8 4-8-4zM4 7l8 4 8-4M12 11v10';

export {CAT_ICONS, CAT_FALLBACK};
