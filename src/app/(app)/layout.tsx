import type { ReactNode } from 'react';
import { requireUser } from '@/lib/auth';
import { can, ROLE_LABELS } from '@/lib/roles';
import { NAV } from '@/components/shell/nav';
import { Shell } from '@/components/shell/shell';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const s = await getSettings();
  const items = NAV.filter((n) => can(user.role, n.section));
  const quick = [
    can(user.role, 'students') && user.role !== 'oqituvchi' && user.role !== 'support' && { href: '/oquvchilar?yangi=1', label: "O'quvchi qo'shish" },
    can(user.role, 'leads') && { href: '/lidlar?yangi=1', label: "Lid qo'shish" },
    can(user.role, 'payments') && { href: '/tolovlar?yangi=1', label: "To'lov qabul qilish" },
    can(user.role, 'attendance') && { href: '/davomat', label: 'Davomat belgilash' },
    can(user.role, 'finance') && { href: '/moliya?yangi=1', label: 'Xarajat kiritish' },
    { href: '/vazifalar?yangi=1', label: 'Vazifa berish' },
    { href: '/hisobotlar?yangi=1', label: 'Kunlik hisobot yozish' },
  ].filter(Boolean) as { href: string; label: string }[];
  return (
    <Shell items={items} user={{ fullName: user.fullName, roleLabel: user.position || ROLE_LABELS[user.role] }} centerName={s.centerName} quick={quick}>
      {children}
    </Shell>
  );
}
