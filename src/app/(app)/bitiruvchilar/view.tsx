'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { GraduationCap, Phone, Pencil, Search } from 'lucide-react';
import { Badge, Button, Card, Empty, Field, PageHeader, Stat, cn } from '@/components/ui';
import { Modal } from '@/components/modal';
import { ActionForm } from '@/components/action-form';
import { MoneyInput } from '@/components/money-input';
import { saveGraduate } from '@/app/actions/tasks';
import { money, phone, pct } from '@/lib/format';
import { daysBetween, fmtShort, today } from '@/lib/dates';

type R = {
  id: number; name: string; phone: string | null; graduated_at: string | null; course: string | null; color: string | null;
  workplace: string | null; position: string | null; monthly_income: number | null; freelance: boolean | null; studying_at: string | null;
  last_contact_at: string | null; referrals: number | null; in_telegram_group: boolean | null; note: string | null; results: number;
};

export function GraduatesView({ rows }: { rows: R[] }) {
  const [edit, setEdit] = useState<R | null>(null);
  const [q, setQ] = useState('');
  const [stale, setStale] = useState(false);
  const t = today();
  const isStale = (r: R) => !r.last_contact_at || daysBetween(r.last_contact_at, t) > 90;
  const stats = useMemo(() => {
    const employed = rows.filter((r) => r.workplace || r.freelance).length;
    const incomes = rows.map((r) => r.monthly_income ?? 0).filter((x) => x > 0);
    return {
      employed,
      avg: incomes.length ? incomes.reduce((a, b) => a + b, 0) / incomes.length : 0,
      referrals: rows.reduce((a, r) => a + (r.referrals ?? 0), 0),
      stale: rows.filter(isStale).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);
  const list = rows.filter((r) => (!q || r.name.toLowerCase().includes(q.toLowerCase())) && (!stale || isStale(r)));

  return (
    <>
      <PageHeader title="Bitiruvchilar" sub="Ular bilan aloqa uzilmasa, o'zlari tanishlarini yuboradi" />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Bitiruvchilar" value={String(rows.length)} />
        <Stat label="Ishlayapti yoki frilans" value={rows.length ? pct((stats.employed / rows.length) * 100) : '—'} hint={`${stats.employed} kishi`} tone="good" />
        <Stat label="O'rtacha daromad" value={stats.avg ? money(stats.avg, false) : '—'} hint="so'm, oyiga" />
        <Stat label="Tavsiya qilganlari" value={String(stats.referrals)} hint="yangi o'quvchi" />
      </div>
      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ism bo'yicha qidirish" className="field pl-9" />
          </div>
          <button onClick={() => setStale((v) => !v)} className={cn('inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold', stale ? 'border-ink bg-ink text-white' : 'border-line text-fg-muted')}>
            3 oydan beri aloqa yo&apos;q <span className="tnum opacity-70">{stats.stale}</span>
          </button>
        </div>
        {list.length === 0 ? (
          <Empty icon={<GraduationCap className="h-5 w-5" />} title={rows.length ? 'Topilmadi' : "Hali bitiruvchi yo'q"} text={rows.length ? undefined : "O'quvchi kursni tugatganda uning holatini \"Bitirdi\" qiling, u shu yerga tushadi."} />
        ) : (
          <ul className="divide-y divide-line">
            {list.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:px-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/oquvchilar?id=${r.id}`} className="font-bold hover:text-brand">
                      {r.name}
                    </Link>
                    {r.course && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
                        <span className="h-2 w-2 rounded-sm" style={{ background: r.color ?? '#8C9A97' }} /> {r.course}
                      </span>
                    )}
                    {isStale(r) && <Badge tone="warn">Aloqa kerak</Badge>}
                  </div>
                  <div className="mt-0.5 text-[13px] text-fg-muted">
                    {r.workplace ? `${r.workplace}${r.position ? `, ${r.position}` : ''}` : r.freelance ? 'Frilanser' : r.studying_at ? `O'qiyapti: ${r.studying_at}` : "Ish joyi noma'lum"}
                    {r.monthly_income ? `, ${money(r.monthly_income)}` : ''}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
                  <span>Bitirgan: {fmtShort(r.graduated_at)}</span>
                  <span>Aloqa: {fmtShort(r.last_contact_at)}</span>
                  {(r.referrals ?? 0) > 0 && <Badge tone="good">{r.referrals} tavsiya</Badge>}
                  {r.phone && (
                    <a href={`tel:+${r.phone}`} className="inline-flex h-8 items-center gap-1 rounded-field border border-line-strong px-2.5 font-semibold text-fg tnum hover:bg-canvas">
                      <Phone className="h-3.5 w-3.5" /> {phone(r.phone)}
                    </a>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => setEdit(r)}>
                    <Pencil className="h-3.5 w-3.5" /> Yangilash
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Modal open={!!edit} onClose={() => setEdit(null)} title="Bitiruvchi ma'lumotlari" sub={edit?.name}>
        {edit && (
          <ActionForm action={saveGraduate.bind(null, edit.id)} onDone={() => setEdit(null)} onCancel={() => setEdit(null)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Ish joyi">
                <input name="workplace" defaultValue={edit.workplace ?? ''} className="field" />
              </Field>
              <Field label="Lavozimi">
                <input name="position" defaultValue={edit.position ?? ''} className="field" />
              </Field>
              <Field label="Oylik daromadi">
                <MoneyInput name="monthlyIncome" defaultValue={edit.monthly_income} />
              </Field>
              <Field label="O'qiyotgan joyi">
                <input name="studyingAt" defaultValue={edit.studying_at ?? ''} className="field" />
              </Field>
              <Field label="Oxirgi aloqa">
                <input type="date" name="lastContactAt" defaultValue={t} className="field" />
              </Field>
              <Field label="Tavsiya qilgan o'quvchilar">
                <input type="number" min={0} name="referrals" defaultValue={edit.referrals ?? 0} className="field" />
              </Field>
            </div>
            <div className="flex flex-wrap gap-5">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" name="freelance" defaultChecked={!!edit.freelance} className="h-4 w-4 accent-[#0E7C6B]" /> Frilans zakazlar oladi
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" name="inTelegramGroup" defaultChecked={!!edit.in_telegram_group} className="h-4 w-4 accent-[#0E7C6B]" /> Bitiruvchilar guruhida
              </label>
            </div>
            <Field label="Izoh">
              <textarea name="note" defaultValue={edit.note ?? ''} rows={2} className="field" />
            </Field>
          </ActionForm>
        )}
      </Modal>
    </>
  );
}
