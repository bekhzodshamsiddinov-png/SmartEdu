import { redirect } from 'next/navigation';
import { usersCount } from '@/app/actions/auth';
import { SetupForm } from './form';

export const dynamic = 'force-dynamic';

export default async function SetupPage() {
  if ((await usersCount()) > 0) redirect('/login');
  return (
    <>
      <h1 className="text-[26px] font-extrabold tracking-[-0.02em]">Tizimni sozlash</h1>
      <p className="mt-1.5 text-sm text-fg-muted">Rahbar hisobini yarating. Qolgan xodimlarni keyin o&apos;zingiz qo&apos;shasiz.</p>
      <SetupForm needCode={!!process.env.SETUP_CODE} />
    </>
  );
}
