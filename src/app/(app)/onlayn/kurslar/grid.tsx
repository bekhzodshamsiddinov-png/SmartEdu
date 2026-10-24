'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, MonitorPlay, PlayCircle, Clock3, Users } from 'lucide-react';
import { Badge, Button, Card, Empty, PageHeader } from '@/components/ui';
import { Modal } from '@/components/modal';
import { OnlineTabsClient } from '@/components/online/tabs-client';
import { CourseForm } from '@/components/online/course-form';
import { COURSE_STATUS, LEVELS } from '@/lib/constants';
import { money } from '@/lib/format';

type R = { id: number; title: string; subtitle: string | null; color: string; status: string; price: number; old_price: number | null; level: string; modules: number; lessons: number; minutes: number; sales: number; revenue: number };

export function CoursesGrid({ rows, canEdit, openNew }: { rows: R[]; canEdit: boolean; openNew: boolean }) {
  const [open, setOpen] = useState(openNew);
  const router = useRouter();
  useEffect(() => setOpen(openNew), [openNew]);
  const close = () => (openNew ? router.push('/onlayn/kurslar') : setOpen(false));
  return (
    <>
      <PageHeader
        title="Onlayn kurslar"
        sub={`${rows.length} ta kurs, ${rows.filter((r) => r.status === 'sotuvda').length} tasi sotuvda`}
        actions={
          canEdit && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Yangi kurs
            </Button>
          )
        }
      />
      <OnlineTabsClient active="/onlayn/kurslar" />
      {rows.length === 0 ? (
        <Card>
          <Empty icon={<MonitorPlay className="h-5 w-5" />} title="Hali kurs yo'q" text="Kurs yarating, keyin unga modul va video darslar qo'shasiz." action={canEdit ? <Button onClick={() => setOpen(true)}>Kurs yaratish</Button> : undefined} />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((c) => (
            <Link key={c.id} href={`/onlayn/kurslar/${c.id}`} className="card group overflow-hidden transition-colors hover:border-line-strong">
              <div className="relative h-28 overflow-hidden" style={{ background: c.color }}>
                <svg className="absolute -right-6 -top-6 h-40 w-40 opacity-20" viewBox="0 0 100 100" aria-hidden>
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#fff" strokeWidth="10" />
                  <circle cx="50" cy="50" r="16" fill="#fff" />
                </svg>
                <div className="absolute left-4 top-4">
                  <Badge tone={COURSE_STATUS[c.status]?.tone ?? 'neutral'} className="border-white/0 bg-white/95">
                    {COURSE_STATUS[c.status]?.label ?? c.status}
                  </Badge>
                </div>
                <div className="absolute bottom-3 left-4 text-xs font-bold text-white/85">{LEVELS[c.level] ?? c.level}</div>
              </div>
              <div className="p-4">
                <h2 className="line-clamp-2 text-[16px] font-extrabold leading-snug group-hover:text-brand">{c.title}</h2>
                {c.subtitle && <p className="mt-1 line-clamp-2 text-[13px] text-fg-muted">{c.subtitle}</p>}
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted">
                  <span className="inline-flex items-center gap-1">
                    <PlayCircle className="h-3.5 w-3.5" /> {c.modules} modul, {c.lessons} dars
                  </span>
                  {c.minutes > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="h-3.5 w-3.5" /> {Math.floor(c.minutes / 60)} soat {c.minutes % 60} daq
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> {c.sales} sotuv
                  </span>
                </div>
                <div className="mt-4 flex items-end justify-between border-t border-line pt-3">
                  <div>
                    <div className="text-[17px] font-extrabold tnum">{money(c.price)}</div>
                    {c.old_price && c.old_price > c.price && <div className="text-xs text-fg-faint line-through tnum">{money(c.old_price)}</div>}
                  </div>
                  <div className="text-right text-xs text-fg-muted">
                    Tushum
                    <div className="text-sm font-bold text-fg tnum">{money(c.revenue)}</div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
      <Modal open={open} onClose={close} title="Yangi onlayn kurs" sub="Asosiy ma'lumotlar. Darslarni keyingi sahifada qo'shasiz.">
        <CourseForm compact onDone={close} />
      </Modal>
    </>
  );
}
