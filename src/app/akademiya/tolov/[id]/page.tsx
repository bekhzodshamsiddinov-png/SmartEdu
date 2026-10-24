import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { CheckCircle2, Clock, Send } from 'lucide-react';
import { db } from '@/db';
import { courseOrders, onlineCourses } from '@/db/schema';
import { requireLearner } from '@/lib/learner';
import { getSettings } from '@/lib/settings';
import { clickPayUrl, paymePayUrl, siteUrl } from '@/lib/payments';
import { money } from '@/lib/format';
import { CardPay } from './card-pay';

export const metadata = { title: "To'lov" };

export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const l = await requireLearner(`/akademiya/tolov/${id}`);
  const [o] = await db.select().from(courseOrders).where(and(eq(courseOrders.id, Number(id)), eq(courseOrders.learnerId, l.id)));
  if (!o) notFound();
  const [c] = await db.select().from(onlineCourses).where(eq(onlineCourses.id, o.courseId));
  const s = await getSettings();
  const back = `${siteUrl()}/akademiya/tolov/${o.id}`;
  const click = clickPayUrl(o.id, o.amount, back);
  const payme = paymePayUrl(o.id, o.amount, back);
  const tg = s.telegram?.replace(/^@/, '');
  const reported = (o.note ?? '').startsWith("O'quvchi to'laganini bildirdi");

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:py-14">
      <Link href={`/akademiya/kurs/${c.slug}`} className="text-sm font-semibold text-fg-muted hover:text-fg">
        {c.title}
      </Link>
      <h1 className="mt-2 text-[28px] font-extrabold tracking-[-0.02em]">Buyurtma #{o.id}</h1>

      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-white">
        <div className="h-1.5" style={{ background: c.color }} />
        <div className="flex items-center justify-between gap-4 p-5">
          <div className="min-w-0">
            <div className="truncate font-bold">{c.title}</div>
            {o.promoCode && <div className="text-xs text-fg-muted">Promokod: {o.promoCode}</div>}
          </div>
          <div className="text-right">
            <div className="text-xl font-extrabold tnum">{money(o.amount)}</div>
            {o.originalPrice > o.amount && <div className="text-xs text-fg-faint line-through tnum">{money(o.originalPrice)}</div>}
          </div>
        </div>
      </div>

      {o.status === 'tolandi' ? (
        <div className="mt-6 rounded-2xl bg-good-soft p-6 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-good" />
          <div className="mt-3 text-lg font-extrabold text-good">To&apos;lov qabul qilindi</div>
          <p className="mt-1 text-sm text-fg-muted">Kurs ochildi. Omad!</p>
          <Link href={`/akademiya/oqish/${c.slug}`} className="mt-5 inline-flex h-12 items-center rounded-field bg-brand px-6 text-[15px] font-extrabold text-white">
            O&apos;qishni boshlash
          </Link>
        </div>
      ) : o.status !== 'kutilmoqda' ? (
        <div className="mt-6 rounded-2xl border border-line bg-white p-6 text-center">
          <div className="text-lg font-extrabold">Buyurtma bekor qilingan</div>
          <Link href={`/akademiya/kurs/${c.slug}`} className="mt-4 inline-flex h-11 items-center rounded-field bg-ink px-5 text-sm font-bold text-white">
            Kurs sahifasiga qaytish
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {(click || payme) && (
            <div className="rounded-2xl border border-line bg-white p-5">
              <h2 className="font-extrabold">Onlayn to&apos;lov</h2>
              <p className="mt-1 text-sm text-fg-muted">To&apos;lovdan so&apos;ng kurs avtomatik ochiladi.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {click && (
                  <a href={click} className="flex h-12 items-center justify-center rounded-field bg-[#0B6CF2] text-[15px] font-extrabold text-white hover:brightness-110">
                    Click orqali to&apos;lash
                  </a>
                )}
                {payme && (
                  <a href={payme} className="flex h-12 items-center justify-center rounded-field bg-[#00A9B6] text-[15px] font-extrabold text-white hover:brightness-110">
                    Payme orqali to&apos;lash
                  </a>
                )}
              </div>
            </div>
          )}
          {s.payCard ? (
            <div className="rounded-2xl border border-line bg-white p-5">
              <h2 className="font-extrabold">{click || payme ? "Yoki karta orqali o'tkazma" : "Karta orqali to'lov"}</h2>
              <p className="mt-1 text-sm text-fg-muted">
                {money(o.amount)} ni quyidagi kartaga o&apos;tkazing va &quot;To&apos;ladim&quot; tugmasini bosing. Administrator tekshirib, kursni ochadi.
              </p>
              <CardPay orderId={o.id} card={s.payCard} holder={s.payCardHolder} amount={o.amount} reported={reported} />
            </div>
          ) : (
            !click &&
            !payme && (
              <div className="rounded-2xl border border-line bg-white p-5">
                <h2 className="font-extrabold">To&apos;lov uchun bog&apos;laning</h2>
                <p className="mt-1 text-sm text-fg-muted">Buyurtmangiz qabul qilindi. Administrator siz bilan bog&apos;lanib, to&apos;lov usulini aytadi.</p>
              </div>
            )
          )}
          {reported && (
            <p className="flex items-center gap-2 rounded-field bg-warn-soft px-4 py-3 text-sm font-semibold text-warn">
              <Clock className="h-4 w-4" /> To&apos;lovingiz tekshirilmoqda. Odatda bir necha soat ichida kurs ochiladi.
            </p>
          )}
          {tg && (
            <a href={`https://t.me/${tg}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 text-sm font-bold text-brand">
              <Send className="h-4 w-4" /> Savol bo&apos;lsa, Telegramda yozing
            </a>
          )}
        </div>
      )}
    </div>
  );
}
