import { redirect } from 'next/navigation';
import { hasAnyUser } from '@/lib/setup-state';
import { LoginForm } from './form';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (!(await hasAnyUser())) redirect('/setup');
  return (
    <>
      <h1 className="text-[26px] font-extrabold tracking-[-0.02em]">Tizimga kirish</h1>
      <p className="mt-1.5 text-sm text-fg-muted">Telefon raqamingiz va parolingizni kiriting.</p>
      <LoginForm />
    </>
  );
}
