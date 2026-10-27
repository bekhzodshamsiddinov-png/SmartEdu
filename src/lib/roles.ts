import type { Role } from '@/db/schema';

export const ROLE_LABELS: Record<Role, string> = {
  rahbar: 'Rahbar',
  admin: 'Administrator',
  oqituvchi: "O'qituvchi",
  support: 'Support teacher',
  sotuv: 'Sotuv menejeri',
  marketing: 'Marketolog',
  bugalter: 'Bugalter',
};

export type Section =
  | 'desk'
  | 'control'
  | 'dashboard'
  | 'leads'
  | 'students'
  | 'groups'
  | 'attendance'
  | 'payments'
  | 'finance'
  | 'staff'
  | 'tasks'
  | 'graduates'
  | 'reports'
  | 'settings'
  | 'online'
  | 'onlineEdit'
  | 'schedule'
  | 'messages'
  | 'subscriptions';

const ACCESS: Record<Section, Role[]> = {
  desk: ['admin', 'rahbar'],
  control: ['rahbar'],
  dashboard: ['rahbar', 'admin', 'bugalter', 'oqituvchi', 'support', 'sotuv', 'marketing'],
  leads: ['rahbar', 'admin', 'sotuv', 'marketing'],
  students: ['rahbar', 'admin', 'oqituvchi', 'support', 'sotuv', 'bugalter'],
  groups: ['rahbar', 'admin', 'oqituvchi', 'support'],
  attendance: ['rahbar', 'admin', 'oqituvchi', 'support'],
  payments: ['rahbar', 'admin', 'bugalter'],
  finance: ['rahbar', 'bugalter'],
  staff: ['rahbar'],
  tasks: ['rahbar', 'admin', 'oqituvchi', 'support', 'sotuv', 'marketing', 'bugalter'],
  graduates: ['rahbar', 'admin', 'sotuv', 'oqituvchi'],
  reports: ['rahbar', 'admin', 'bugalter', 'oqituvchi', 'support', 'sotuv', 'marketing'],
  settings: ['rahbar'],
  online: ['rahbar', 'marketing', 'admin', 'sotuv'],
  onlineEdit: ['rahbar', 'marketing'],
  schedule: ['rahbar', 'admin', 'oqituvchi', 'support', 'sotuv'],
  messages: ['rahbar', 'admin'],
  subscriptions: ['rahbar', 'admin', 'bugalter'],
};

export function can(role: Role, section: Section) {
  return ACCESS[section].includes(role);
}

/** Moliyaviy raqamlarni ko'ra oladiganlar */
export function seesMoney(role: Role) {
  return role === 'rahbar' || role === 'bugalter';
}
