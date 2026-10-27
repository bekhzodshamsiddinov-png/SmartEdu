import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { branches, courses } from '@/db/schema';
import { getSettings } from '@/lib/settings';
import { ApplyForm } from './form';

export const metadata = { title: 'Kursga yozilish' };

export default async function ApplyPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const [s, cs, bs] = await Promise.all([
    getSettings(),
    db.select({ id: courses.id, name: courses.name }).from(courses).where(eq(courses.active, true)).orderBy(asc(courses.name)),
    db.select({ id: branches.id, name: branches.name }).from(branches).where(and(eq(branches.active, true))).orderBy(asc(branches.id)),
  ]);
  const course = cs.find((c) => String(c.id) === sp.kurs)?.id ?? null;
  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:py-16">
      <div className="rounded-2xl border border-line bg-white p-6 shadow-lift sm:p-8">
        <h1 className="text-[26px] font-extrabold tracking-[-0.02em]">Kursga yozilish</h1>
        <p className="mt-1 text-sm text-fg-muted">Ma&apos;lumotlaringizni qoldiring — {s.centerName} menejeri siz bilan bog&apos;lanib, bepul sinov darsiga yozib qo&apos;yadi.</p>
        <ApplyForm source={(sp.m ?? '').slice(0, 40)} courses={cs} branches={bs} course={course} branch={Number(sp.f) || null} />
      </div>
    </div>
  );
}
