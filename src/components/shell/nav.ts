import type { Section } from '@/lib/roles';

export type NavItem = { href: string; label: string; section: Section; icon: string };

export const NAV: NavItem[] = [
  { href: '/ish-stoli', label: 'Ish stoli', section: 'desk', icon: 'desk' },
  { href: '/', label: 'Bosh sahifa', section: 'dashboard', icon: 'home' },
  { href: '/nazorat', label: 'Nazorat', section: 'control', icon: 'control' },
  { href: '/lidlar', label: 'Lidlar', section: 'leads', icon: 'magnet' },
  { href: '/oquvchilar', label: "O'quvchilar", section: 'students', icon: 'users' },
  { href: '/guruhlar', label: 'Guruhlar', section: 'groups', icon: 'layers' },
  { href: '/davomat', label: 'Davomat', section: 'attendance', icon: 'check' },
  { href: '/tolovlar', label: "To'lovlar", section: 'payments', icon: 'wallet' },
  { href: '/moliya', label: 'Moliya', section: 'finance', icon: 'bank' },
  { href: '/xodimlar', label: 'Xodimlar', section: 'staff', icon: 'brief' },
  { href: '/vazifalar', label: 'Vazifalar', section: 'tasks', icon: 'tasks' },
  { href: '/onlayn', label: 'Onlayn kurslar', section: 'online', icon: 'play' },
  { href: '/bitiruvchilar', label: 'Bitiruvchilar', section: 'graduates', icon: 'grad' },
  { href: '/hisobotlar', label: 'Hisobotlar', section: 'reports', icon: 'chart' },
  { href: '/sozlamalar', label: 'Sozlamalar', section: 'settings', icon: 'cog' },
];
