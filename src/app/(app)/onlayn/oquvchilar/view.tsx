'use client';
import { useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Search, Users, Pencil, Phone, Send, Mail, KeyRound } from 'lucide-react';
import { Avatar, Badge, Button, Card, Empty, Field, PageHeader, Progress } from '@/components/ui';
import { Drawer, Modal } from '@/components/modal';
import { ActionForm } from '@/components/action-form';
import { OnlineTabsClient } from '@/components/online/tabs-client';
import { saveLearner, setLearnerPassword } from '@/app/actions/online';
import { LEAD_SOURCES, ORDER_METHODS, ORDER_STATUS } from '@/lib/constants';
import { money, phone } from '@/lib/format';
import { fmtDate, fmtShort } from '@/lib/dates';

type L = { id: number; name: string; phone: string; email: string | null; telegram: string | null; city: string | null; source: string | null; created: string; courses: string | null; paid: number; orders: number };
type D = {
  learner: L;
  orders: { id: number; course: string; color: string; amount: number; status: string; paid_at: string | null; access_until: string | null; method: string }[];
  progress: { course: string; total: number; done: number; last: string | null }[];
};

export function LearnersView({ rows, detail }: { rows: L[]; detail: D | null }) {
  const router = useRouter();
  const path = usePathname();
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState(false);
  const [pw, setPw] = useState(false);
  const list = useMemo(() => {
    const t = q.toLowerCase().trim();
    const d = q.replace(/\D/g, '');
    return rows.filter((r) => !t || r.name.toLowerCase().includes(t) || (d.length >= 3 && r.phone.includes(d)) || (r.email ?? '').toLowerCase().includes(t));
  }, [rows, q]);
  const buyers = rows.filter((r) => r.paid > 0).length;
  const total = rows.reduce((s, r) => s + r.paid, 0);
  return (
    <>
      <PageHeader title="Onlayn o'quvchilar" sub={`${rows.length} kishi, ${buyers} tasi xaridor, umumiy tushum ${money(total)}`} />
      <OnlineTabsClient active="/onlayn/oquvchilar" />
      <Card>
        <div className="border-b border-line p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ism, telefon yoki email" className="field pl-9" aria-label="Qidirish" />
          </div>
        </div>
        {list.length === 0 ? (
          <Empty icon={<Users className="h-5 w-5" />} title={rows.length ? 'Topilmadi' : "Hali onlayn o'quvchi yo'q"} text={rows.length ? undefined : "Sotuv qo'shilganda o'quvchi shu yerda paydo bo'ladi."} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="border-b border-line bg-canvas/60">
                <tr>
                  <th className="th">O&apos;quvchi</th>
                  <th className="th">Kurslari</th>
                  <th className="th">Manba</th>
                  <th className="th text-right">To&apos;lagan</th>
                  <th className="th text-right">Qo&apos;shilgan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((r) => (
                  <tr key={r.id} onClick={() => router.push(`${path}?id=${r.id}`, { scroll: false })} className="cursor-pointer hover:bg-canvas/60">
                    <td className="td">
                      <div className="flex items-center gap-3">
                        <Avatar name={r.name} size={34} color="#008A70" />
                        <div>
                          <div className="font-bold">{r.name}</div>
                          <div className="text-xs text-fg-muted tnum">{phone(r.phone)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="td max-w-[280px] truncate text-[13px]">{r.courses ?? <span className="text-fg-faint">Xarid yo&apos;q</span>}</td>
                    <td className="td text-[13px] text-fg-muted">{r.source ?? '—'}</td>
                    <td className="td text-right font-bold tnum">{money(r.paid)}</td>
                    <td className="td text-right text-[13px] text-fg-muted">{fmtShort(r.created)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {detail && (
        <Drawer open onClose={() => router.push(path, { scroll: false })} title={detail.learner.name} sub={<span className="tnum">{phone(detail.learner.phone)}</span>}>
          <div className="flex flex-wrap gap-2 border-b border-line bg-white px-5 py-3">
            <a href={`tel:+${detail.learner.phone}`} className="inline-flex h-8 items-center gap-1.5 rounded-field bg-brand px-3 text-[13px] font-bold text-white">
              <Phone className="h-3.5 w-3.5" /> Qo&apos;ng&apos;iroq
            </a>
            {detail.learner.telegram && (
              <a href={`https://t.me/${detail.learner.telegram.replace('@', '')}`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-field border border-line-strong px-3 text-[13px] font-semibold">
                <Send className="h-3.5 w-3.5" /> Telegram
              </a>
            )}
            {detail.learner.email && (
              <a href={`mailto:${detail.learner.email}`} className="inline-flex h-8 items-center gap-1.5 rounded-field border border-line-strong px-3 text-[13px] font-semibold">
                <Mail className="h-3.5 w-3.5" /> Email
              </a>
            )}
            <Button size="sm" variant="secondary" onClick={() => setEdit(true)}>
              <Pencil className="h-3.5 w-3.5" /> Tahrirlash
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setPw(true)}>
              <KeyRound className="h-3.5 w-3.5" /> Parol berish
            </Button>
          </div>
          <div className="space-y-4 p-5">
            <div className="card p-4">
              <h3 className="mb-3 text-sm font-bold">O&apos;zlashtirish</h3>
              {detail.progress.length === 0 ? (
                <p className="text-sm text-fg-muted">Sotib olingan kurs yo&apos;q.</p>
              ) : (
                <ul className="space-y-3">
                  {detail.progress.map((p) => (
                    <li key={p.course}>
                      <div className="mb-1 flex justify-between text-[13px]">
                        <span className="font-semibold">{p.course}</span>
                        <span className="tnum text-fg-muted">
                          {p.done}/{p.total} dars{p.last ? `, oxirgi ${fmtShort(p.last)}` : ''}
                        </span>
                      </div>
                      <Progress value={p.total ? (p.done / p.total) * 100 : 0} />
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-fg-muted">Darslarni ko&apos;rish onlayn platforma ishga tushgach avtomatik yoziladi.</p>
            </div>
            <div className="card overflow-hidden">
              <div className="border-b border-line px-4 py-2.5 text-sm font-bold">Buyurtmalar</div>
              <ul className="divide-y divide-line">
                {detail.orders.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-bold">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: o.color }} />
                        {o.course}
                      </div>
                      <div className="text-xs text-fg-muted">
                        {ORDER_METHODS[o.method] ?? o.method}
                        {o.paid_at && `, ${fmtDate(o.paid_at)}`}
                        {o.access_until && `, kirish ${fmtShort(o.access_until)} gacha`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold tnum">{money(o.amount)}</div>
                      <Badge tone={ORDER_STATUS[o.status]?.tone ?? 'neutral'}>{ORDER_STATUS[o.status]?.label}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <dl className="card grid gap-3 p-4 text-sm sm:grid-cols-2">
              {[
                ['Email', detail.learner.email],
                ['Telegram', detail.learner.telegram],
                ['Shahar', detail.learner.city],
                ['Manba', detail.learner.source],
                ["Qo'shilgan", fmtDate(detail.learner.created)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-fg-muted">{k}</dt>
                  <dd className="mt-0.5 font-semibold">{v || '—'}</dd>
                </div>
              ))}
            </dl>
          </div>
          <Modal open={pw} onClose={() => setPw(false)} title="Saytga kirish paroli" sub="O'quvchi telefon raqami va shu parol bilan Akademiya saytiga kiradi" size="sm">
            <ActionForm action={setLearnerPassword.bind(null, detail.learner.id)} onDone={() => setPw(false)} onCancel={() => setPw(false)} submitLabel="Parolni o'rnatish">
              <Field label="Yangi parol">
                <input name="password" minLength={8} defaultValue={genPassword()} className="field font-mono tracking-wider" required />
              </Field>
            </ActionForm>
          </Modal>
          <Modal open={edit} onClose={() => setEdit(false)} title="Ma'lumotlarni tahrirlash" size="sm">
            <ActionForm action={saveLearner.bind(null, detail.learner.id)} onDone={() => setEdit(false)} onCancel={() => setEdit(false)}>
              <Field label="Ism-familiya">
                <input name="fullName" defaultValue={detail.learner.name} className="field" required />
              </Field>
              <Field label="Telefon">
                <input name="phone" defaultValue={detail.learner.phone.slice(3)} className="field" required />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Email">
                  <input name="email" type="email" defaultValue={detail.learner.email ?? ''} className="field" />
                </Field>
                <Field label="Telegram">
                  <input name="telegram" defaultValue={detail.learner.telegram ?? ''} className="field" placeholder="@username" />
                </Field>
                <Field label="Shahar">
                  <input name="city" defaultValue={detail.learner.city ?? ''} className="field" />
                </Field>
                <Field label="Manba">
                  <select name="source" defaultValue={detail.learner.source ?? ''} className="field">
                    <option value="">—</option>
                    {LEAD_SOURCES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Izoh">
                <textarea name="note" rows={2} className="field" />
              </Field>
            </ActionForm>
          </Modal>
        </Drawer>
      )}
    </>
  );
}

/** Kriptografik tasodifiy, oson o'qiladigan parol: 4 harf + 4 raqam */
function genPassword() {
  const L = 'abcdefghjkmnpqrstuvwxyz';
  const r = new Uint32Array(8);
  crypto.getRandomValues(r);
  let s = '';
  for (let i = 0; i < 4; i++) s += L[r[i] % L.length];
  for (let i = 4; i < 8; i++) s += String(r[i] % 10);
  return s;
}
