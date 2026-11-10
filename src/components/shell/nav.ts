import type { Section } from '@/lib/roles';

export type NavItem = { href: string; label: string; section: Section; icon: string; group: string };

/** Menyu bo'limlar bo'yicha guruhlangan — 19 ta band ichida tez topiladi */
export const NAV: NavItem[] = [
  { href: '/ish-stoli', label: 'Ish stoli', section: 'desk', icon: 'desk', group: 'Kundalik' },
  { href: '/', label: 'Bosh sahifa', section: 'dashboard', icon: 'home', group: 'Kundalik' },
  { href: '/nazorat', label: 'Nazorat', section: 'control', icon: 'control', group: 'Kundalik' },
  { href: '/vazifalar', label: 'Vazifalar', section: 'tasks', icon: 'tasks', group: 'Kundalik' },
  { href: '/xabarlar', label: 'Xabarlar', section: 'messages', icon: 'messages', group: 'Kundalik' },
  { href: '/lidlar', label: 'Lidlar', section: 'leads', icon: 'magnet', group: 'Sotuv' },
  { href: '/oquvchilar', label: "O'quvchilar", section: 'students', icon: 'users', group: "O'quv jarayoni" },
  { href: '/guruhlar', label: 'Guruhlar', section: 'groups', icon: 'layers', group: "O'quv jarayoni" },
  { href: '/jadval', label: 'Dars jadvali', section: 'schedule', icon: 'schedule', group: "O'quv jarayoni" },
  { href: '/davomat', label: 'Davomat', section: 'attendance', icon: 'check', group: "O'quv jarayoni" },
  { href: '/yutuqlar', label: 'Yutuqlar', section: 'students', icon: 'trophy', group: "O'quv jarayoni" },
  { href: '/bitiruvchilar', label: 'Bitiruvchilar', section: 'graduates', icon: 'grad', group: "O'quv jarayoni" },
  { href: '/tolovlar', label: "To'lovlar", section: 'payments', icon: 'wallet', group: 'Moliya' },
  { href: '/abonementlar', label: 'Abonementlar', section: 'subscriptions', icon: 'ticket', group: 'Moliya' },
  { href: '/moliya', label: 'Moliya', section: 'finance', icon: 'bank', group: 'Moliya' },
  { href: '/onlayn', label: 'Onlayn kurslar', section: 'online', icon: 'play', group: 'Boshqaruv' },
  { href: '/xodimlar', label: 'Xodimlar', section: 'staff', icon: 'brief', group: 'Boshqaruv' },
  { href: '/hisobotlar', label: 'Hisobotlar', section: 'reports', icon: 'chart', group: 'Boshqaruv' },
  { href: '/sozlamalar', label: 'Sozlamalar', section: 'settings', icon: 'cog', group: 'Boshqaruv' },
];
