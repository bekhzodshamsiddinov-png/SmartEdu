import Link from 'next/link';
import { PlayCircle, Clock3, Gift } from 'lucide-react';
import { money } from '@/lib/format';

const CAT: Record<string, string> = { ai: "Sun'iy intellekt", youtube: 'YouTube', boshqa: 'Kurs' };
const LVL: Record<string, string> = { boshlangich: "Boshlang'ich", orta: "O'rta", yuqori: 'Yuqori' };

export function hours(min: number) {
  if (!min) return null;
  const h = Math.floor(min / 60);
  return h ? `${h} soat${min % 60 ? ` ${min % 60} daq` : ''}` : `${min} daq`;
}

export type CardCourse = { slug: string; title: string; subtitle: string | null; price: number; old_price: number | null; color: string; level: string; category: string; lessons: number; minutes: number; free: number };

export function CourseCard({ c, owned }: { c: CardCourse; owned?: boolean }) {
  const off = c.old_price && c.old_price > c.price ? Math.round((1 - c.price / c.old_price) * 100) : 0;
  return (
    <Link href={`/akademiya/kurs/${c.slug}`} className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white transition-shadow hover:shadow-pop">
      <div className="relative flex h-36 flex-col justify-between overflow-hidden p-5 text-white" style={{ background: c.color }}>
        <svg className="absolute -bottom-10 -right-10 h-44 w-44 opacity-[0.16]" viewBox="0 0 100 100" aria-hidden>
          <circle cx="50" cy="50" r="46" fill="none" stroke="#fff" strokeWidth="8" />
          <path d="M42 34 L68 50 L42 66 Z" fill="#fff" />
        </svg>
        <div className="flex items-center gap-2 text-xs font-bold">
          <span className="rounded-full bg-white/20 px-2.5 py-1">{CAT[c.category] ?? c.category}</span>
          <span className="rounded-full bg-black/15 px-2.5 py-1">{LVL[c.level] ?? c.level}</span>
        </div>
        {off > 0 && <span className="self-start rounded-md bg-white px-2 py-0.5 text-xs font-extrabold text-bad">−{off}%</span>}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-[17px] font-extrabold leading-snug group-hover:text-brand">{c.title}</h3>
        {c.subtitle && <p className="mt-1.5 line-clamp-2 text-sm text-fg-muted">{c.subtitle}</p>}
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-fg-muted">
          <span className="inline-flex items-center gap-1.5">
            <PlayCircle className="h-4 w-4" /> {c.lessons} dars
          </span>
          {hours(c.minutes) && (
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-4 w-4" /> {hours(c.minutes)}
            </span>
          )}
          {c.free > 0 && (
            <span className="inline-flex items-center gap-1.5 text-info">
              <Gift className="h-4 w-4" /> {c.free} ta bepul dars
            </span>
          )}
        </div>
        <div className="mt-auto flex items-end justify-between pt-5">
          {owned ? (
            <span className="text-sm font-bold text-good">Sizda bor</span>
          ) : (
            <div>
              <div className="text-xl font-extrabold tracking-[-0.01em] tnum">{c.price ? money(c.price) : 'Bepul'}</div>
              {off > 0 && <div className="text-sm text-fg-faint line-through tnum">{money(c.old_price!)}</div>}
            </div>
          )}
          <span className="rounded-field bg-ink px-4 py-2.5 text-sm font-bold text-white group-hover:bg-brand">{owned ? 'Davom etish' : "Batafsil"}</span>
        </div>
      </div>
    </Link>
  );
}
