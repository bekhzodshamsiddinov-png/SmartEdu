import { redirect } from 'next/navigation';
import { hasAnyUser } from '@/lib/setup-state';
import { SetupForm } from './form';

export const dynamic = 'force-dynamic';

export default async function SetupPage() {
  if (await hasAnyUser()) redirect('/login');
  return (
    <>
      <h1 className="text-[26px] font-extrabold tracking-[-0.02em]">Tizimni sozlash</h1>
      <p className="mt-1.5 text-sm text-fg-muted">Rahbar hisobini yarating. Qolgan xodimlarni keyin o&apos;zingiz qo&apos;shasiz.</p>
      <SetupForm needCode={!!process.env.SETUP_CODE} />
    </>
  );
}
