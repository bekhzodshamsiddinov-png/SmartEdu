import { redirect } from 'next/navigation';
import { getLearner } from '@/lib/learner';
import { AuthForms } from './forms';

export const metadata = { title: 'Kirish', robots: { index: false, follow: false } };

export default async function LearnerAuth({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const next = sp.next?.startsWith('/akademiya') ? sp.next : '/akademiya/kabinet';
  if (await getLearner()) redirect(next);
  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:py-16">
      <AuthForms next={next} initial={sp.tab === 'royxat' ? 'royxat' : 'kirish'} />
    </div>
  );
}
