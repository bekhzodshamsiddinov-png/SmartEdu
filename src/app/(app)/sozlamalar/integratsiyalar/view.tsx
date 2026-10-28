'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Circle, Copy, ExternalLink, Instagram, Link2, RefreshCw, ShieldCheck, Unplug, AlertTriangle, KeyRound } from 'lucide-react';
import { Badge, Button, Card, CardHeader, Field, PageHeader, cn } from '@/components/ui';
import { ActionButton, ActionForm } from '@/components/action-form';
import { useToast } from '@/components/toast';
import { metaConnect, metaDisconnect, metaRetry, metaRotateVerifyToken, metaSaveForm, metaSelectPage, metaSyncNow } from '@/app/actions/integrations';
import type { MetaForm } from '@/lib/meta';
import { relative } from '@/lib/dates';

type Meta = {
  hasSecret: boolean;
  connected: boolean;
  appId: string | null;
  verifyToken: string | null;
  pageName: string | null;
  igName: string | null;
  subscribed: boolean;
  forms: MetaForm[];
  pending: { id: string; name: string; ig: string | null }[];
  lastEventAt: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  connectedAt: string | null;
};
type Recent = { id: number; status: string; error: string | null; at: string; lead_id: number | null; name: string | null; source: string | null; campaign: string | null; attempts: number };

const STATUS: Record<string, { l: string; tone: 'good' | 'warn' | 'bad' | 'info' }> = {
  qabul: { l: 'CRM da', tone: 'good' },
  kutilmoqda: { l: 'Navbatda', tone: 'info' },
  jarayonda: { l: 'Yozilmoqda', tone: 'info' },
  xato: { l: 'Xato', tone: 'bad' },
};

export function IntegrationsView({
  webhookUrl,
  meta,
  recent,
  stats,
  branches,
  courses,
}: {
  webhookUrl: string;
  meta: Meta;
  recent: Recent[];
  stats: { today: number; week: number; failed: number };
  branches: { id: number; name: string }[];
  courses: { id: number; name: string }[];
}) {
  const [reconnect, setReconnect] = useState(false);
  const step1 = meta.hasSecret && (meta.connected || meta.pending.length > 0);
  const live = meta.connected && meta.subscribed && !meta.lastError;
  return (
    <>
      <Link href="/sozlamalar" className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-fg-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Sozlamalar
      </Link>
      <PageHeader title="Integratsiyalar" sub="Hamma lid bitta bazaga: Instagram/Facebook target formalari, uitc.uz va qo'lda kiritilganlar" />

      <Card className="mb-5 overflow-hidden">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white" style={{ background: 'linear-gradient(135deg,#F58529,#DD2A7B 55%,#8134AF)' }}>
            <Instagram className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[17px] font-extrabold">Instagram va Facebook lid formalari</h2>
              {live ? <Badge tone="good" dot>Ishlayapti</Badge> : meta.connected ? <Badge tone="warn" dot>Diqqat talab</Badge> : <Badge tone="neutral" dot>Ulanmagan</Badge>}
            </div>
            <p className="mt-0.5 text-[13px] text-fg-muted">
              {meta.connected
                ? `${meta.pageName}${meta.igName ? ` · @${meta.igName}` : ''} — target formasini to'ldirgan odam bir necha soniyada «Lidlar»ga tushadi, kampaniya va reklama nomi bilan.`
                : "Target reklamasidagi «Lead form» to'ldirilishi bilan lid avtomatik CRM ga tushadi. Ulash bir martalik, taxminan 10 daqiqa."}
            </p>
          </div>
          {meta.connected && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <Mini label="Bugun" value={stats.today} />
              <Mini label="7 kun" value={stats.week} />
              <Mini label="Xato" value={stats.failed} bad={stats.failed > 0} />
            </div>
          )}
        </div>
        {meta.lastError && (
          <div className="flex items-start gap-2 border-t border-line bg-bad-soft px-5 py-3 text-[13px] font-medium text-bad" role="alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {meta.lastError}
          </div>
        )}
        {meta.connected && (
          <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3 text-xs text-fg-muted">
            <span>Oxirgi lid: {meta.lastEventAt ? relative(meta.lastEventAt) : "hali yo'q"}</span>
            <span>·</span>
            <span>Oxirgi tekshiruv: {meta.lastSyncAt ? relative(meta.lastSyncAt) : '—'}</span>
            <div className="ml-auto flex gap-2">
              <ActionButton variant="secondary" size="sm" action={metaSyncNow}>
                <RefreshCw className="h-3.5 w-3.5" /> Hozir tekshirish
              </ActionButton>
              <Button size="sm" variant="ghost" onClick={() => setReconnect((v) => !v)}>
                <KeyRound className="h-3.5 w-3.5" /> Qayta ulash
              </Button>
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        <div className="min-w-0 space-y-5">
          {(!meta.connected || reconnect) && (
            <Card>
              <CardHeader title={<Step n={1} done={step1} text="Meta ilovasi va ruxsat" />} sub="Bir marta qilinadi. Parolingizni hech qayerga kiritmaysiz — faqat Meta bergan kalitlar." />
              <div className="space-y-4 px-5 pb-5">
                <ol className="list-decimal space-y-1.5 pl-5 text-[13px] leading-relaxed text-fg-muted">
                  <li>
                    <a className="font-semibold text-brand hover:underline" href="https://developers.facebook.com/apps/creation/" target="_blank" rel="noreferrer">
                      developers.facebook.com
                    </a>{' '}
                    → <b>Create app</b> → «Other» → turi <b>Business</b>. Nomi: masalan «UITC CRM».
                  </li>
                  <li>
                    <b>App settings → Basic</b>: <b>App ID</b> va <b>App Secret</b> (Show) ni nusxalang.
                  </li>
                  <li>
                    <a className="font-semibold text-brand hover:underline" href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer">
                      Graph API Explorer
                    </a>
                    : yuqorida shu ilovani tanlang, ruxsatlar: <code className="rounded bg-canvas px-1">pages_show_list</code>, <code className="rounded bg-canvas px-1">pages_read_engagement</code>, <code className="rounded bg-canvas px-1">pages_manage_metadata</code>, <code className="rounded bg-canvas px-1">leads_retrieval</code>, <code className="rounded bg-canvas px-1">ads_management</code> → <b>Generate Access Token</b> → tokenni nusxalang.
                  </li>
                  <li>Uchalasini pastga qo&apos;ying. Token 60 kunlik tokenga almashtiriladi, sahifa tokeni esa muddatsiz bo&apos;ladi.</li>
                </ol>
                <ActionForm action={metaConnect} submitLabel="Ulash va sahifalarni ko'rish" onDone={() => setReconnect(false)}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="App ID">
                      <input name="appId" defaultValue={meta.appId ?? ''} inputMode="numeric" autoComplete="off" className="field" required />
                    </Field>
                    <Field label="App Secret" hint={meta.hasSecret ? 'Saqlangan — yangilash uchun qayta kiriting' : undefined}>
                      <input name="appSecret" type="password" autoComplete="new-password" className="field" required />
                    </Field>
                  </div>
                  <Field label="Foydalanuvchi tokeni (Graph API Explorer)">
                    <textarea name="userToken" rows={3} autoComplete="off" spellCheck={false} className="field font-mono text-xs" required />
                  </Field>
                  <p className="flex items-start gap-2 text-xs text-fg-muted">
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-good" /> Kalitlar bazada shifrlangan holda saqlanadi, sahifada qayta ko&apos;rsatilmaydi va brauzerga yuborilmaydi.
                  </p>
                </ActionForm>
              </div>
            </Card>
          )}

          {meta.pending.length > 0 && (!meta.connected || reconnect) && (
            <Card>
              <CardHeader title={<Step n={2} done={meta.connected} text="Lidlar keladigan sahifa" />} sub="Instagram akkauntingiz ulangan Facebook sahifani tanlang" />
              <ul className="divide-y divide-line border-t border-line">
                {meta.pending.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-xs text-fg-muted">{p.ig ? `Instagram: @${p.ig}` : 'Instagram ulanmagan'}</div>
                    </div>
                    <ActionButton size="sm" action={() => metaSelectPage(p.id)}>
                      Tanlash
                    </ActionButton>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {meta.hasSecret && (
            <Card>
              <CardHeader title={<Step n={3} done={!!meta.lastEventAt} text="Webhook — lidlar bir zumda tushishi uchun" />} sub="Meta ilovasida: Webhooks → «Page» → Subscribe to this object" />
              <div className="space-y-3 px-5 pb-5">
                <CopyRow label="Callback URL" value={webhookUrl} />
                <CopyRow label="Verify token" value={meta.verifyToken ?? ''} secret />
                <p className="text-[13px] text-fg-muted">
                  So&apos;ng ro&apos;yxatdan <b>leadgen</b> maydonini <b>Subscribe</b> qiling. Meta Business sozlamalarida (<b>Leads Access</b>) shu ilovaga ruxsat bering.
                  Webhook ishlamay qolsa ham CRM har 10 daqiqada oxirgi lidlarni o&apos;zi tekshiradi — lid yo&apos;qolmaydi.
                </p>
                <div className="flex flex-wrap gap-2">
                  <a href="https://developers.facebook.com/tools/lead-ads-testing" target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-field border border-line-strong px-3 text-xs font-bold hover:bg-canvas">
                    <ExternalLink className="h-3.5 w-3.5" /> Sinov lidi yuborish (Meta)
                  </a>
                  <ActionButton size="sm" variant="ghost" action={metaRotateVerifyToken} confirm="Yangi token yaratilsinmi? Eskisi Meta'da ham almashtirilishi kerak.">
                    Tokenni yangilash
                  </ActionButton>
                </div>
              </div>
            </Card>
          )}

          {meta.connected && (
            <Card>
              <CardHeader title="Formalar" sub="Har bir formadan kelgan lid qaysi filial va yo'nalishga tushsin" />
              {meta.forms.length === 0 ? (
                <p className="px-5 pb-5 text-[13px] text-fg-muted">Sahifada hali lid formasi yo&apos;q. Ads Manager&apos;da «Leads» maqsadli reklama yaratsangiz, forma shu yerda paydo bo&apos;ladi («Hozir tekshirish»).</p>
              ) : (
                <ul className="divide-y divide-line border-t border-line">
                  {meta.forms.map((f) => (
                    <li key={f.id} className="px-5 py-3">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate font-semibold">{f.name || f.id}</span>
                        <Badge tone={f.status === 'ACTIVE' ? 'good' : 'neutral'}>{f.status === 'ACTIVE' ? 'Faol' : f.status.toLowerCase() || '—'}</Badge>
                      </div>
                      <ActionForm action={metaSaveForm.bind(null, f.id)} submitLabel="Saqlash" className="[&>div:last-child]:mt-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <select name="branchId" defaultValue={f.branchId ?? ''} className="field h-9" aria-label="Filial">
                            <option value="">Filial: avtomatik</option>
                            {branches.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name}
                              </option>
                            ))}
                          </select>
                          <select name="courseId" defaultValue={f.courseId ?? ''} className="field h-9" aria-label="Yo'nalish">
                            <option value="">Yo&apos;nalish: javobdan aniqlanadi</option>
                            {courses.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </ActionForm>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>

        <div className="min-w-0 space-y-5">
          <UtmBuilder />
          <Card>
            <CardHeader title="Oxirgi kelgan lidlar" sub="Meta formalaridan" />
            {recent.length === 0 ? (
              <p className="px-5 pb-5 text-[13px] text-fg-muted">Hali lid kelmagan.</p>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {recent.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-5 py-2.5 text-[13px]">
                    <div className="min-w-0 flex-1">
                      {r.lead_id ? (
                        <Link href={`/lidlar?id=${r.lead_id}`} className="font-semibold hover:text-brand">
                          {r.name}
                        </Link>
                      ) : (
                        <span className="font-semibold text-fg-muted">Lid #{r.id}</span>
                      )}
                      <div className="truncate text-xs text-fg-muted">{r.error ?? [r.source, r.campaign].filter(Boolean).join(' · ')}</div>
                    </div>
                    <span className="shrink-0 text-xs text-fg-faint tnum">{r.at}</span>
                    <Badge tone={STATUS[r.status]?.tone ?? 'neutral'}>{STATUS[r.status]?.l ?? r.status}</Badge>
                    {r.status === 'xato' && (
                      <ActionButton size="sm" variant="ghost" action={() => metaRetry(r.id)} title="Qayta urinish">
                        <RefreshCw className="h-3.5 w-3.5" />
                      </ActionButton>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {meta.hasSecret && (
            <ActionButton variant="ghost" action={metaDisconnect} confirm="Meta ulanishi o'chirilsinmi? Yangi lidlar kelmay qoladi.">
              <Unplug className="h-4 w-4" /> Ulanishni o&apos;chirish
            </ActionButton>
          )}
        </div>
      </div>
    </>
  );
}

function Step({ n, done, text }: { n: number; done: boolean; text: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      {done ? <CheckCircle2 className="h-5 w-5 text-good" /> : <Circle className="h-5 w-5 text-fg-faint" />}
      <span className="text-fg-muted">{n}.</span> {text}
    </span>
  );
}

function Mini({ label, value, bad }: { label: string; value: number; bad?: boolean }) {
  return (
    <div className="rounded-xl bg-canvas px-3 py-2">
      <div className={cn('text-lg font-extrabold tnum', bad && 'text-bad')}>{value}</div>
      <div className="text-2xs font-semibold text-fg-muted">{label}</div>
    </div>
  );
}

function CopyRow({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const toast = useToast();
  const [show, setShow] = useState(!secret);
  return (
    <div>
      <div className="label">{label}</div>
      <div className="flex gap-2">
        <input readOnly value={show ? value : '•'.repeat(Math.min(32, value.length))} className="field font-mono text-xs" onFocus={(e) => e.currentTarget.select()} aria-label={label} />
        {secret && (
          <Button size="sm" variant="ghost" onClick={() => setShow((v) => !v)}>
            {show ? 'Yashirish' : "Ko'rsatish"}
          </Button>
        )}
        <Button
          size="sm"
          variant="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              toast('Nusxalandi');
            } catch {
              toast("Nusxalab bo'lmadi", 'err');
            }
          }}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

/** Reklama havolasi: uitc.uz yoki akademiyaga o'tadigan target uchun — lid kanal va kampaniya bilan tushadi */
function UtmBuilder() {
  const toast = useToast();
  const [site, setSite] = useState('https://uitc.uz/');
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  const [net, setNet] = useState('instagram');
  const [camp, setCamp] = useState('');
  const [ad, setAd] = useState('');
  const slug = (v: string) => v.trim().replace(/\s+/g, '_').slice(0, 80);
  const u = new URL(site);
  u.searchParams.set('utm_source', net);
  u.searchParams.set('utm_medium', net === 'telegram' ? 'social' : 'paid');
  if (camp.trim()) u.searchParams.set('utm_campaign', slug(camp));
  if (ad.trim()) u.searchParams.set('utm_content', slug(ad));
  const url = u.toString();
  return (
    <Card>
      <CardHeader title={<span className="inline-flex items-center gap-2"><Link2 className="h-4 w-4 text-brand" /> Reklama havolasi</span>} sub="Target odamni saytga olib borsa — shu havolani qo'ying. Ariza «Instagram target, kampaniya» bo'lib tushadi." />
      <div className="space-y-3 px-5 pb-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Sayt">
            <select value={site} onChange={(e) => setSite(e.target.value)} className="field">
              <option value="https://uitc.uz/">uitc.uz</option>
              {origin && <option value={`${origin}/akademiya/ariza`}>Onlayn akademiya (ariza)</option>}
            </select>
          </Field>
          <Field label="Qayerda">
            <select value={net} onChange={(e) => setNet(e.target.value)} className="field">
              <option value="instagram">Instagram target</option>
              <option value="facebook">Facebook target</option>
              <option value="telegram">Telegram</option>
            </select>
          </Field>
          <Field label="Kampaniya">
            <input value={camp} onChange={(e) => setCamp(e.target.value)} className="field" placeholder="Oktabr AI kursi" maxLength={80} />
          </Field>
          <Field label="Reklama / video">
            <input value={ad} onChange={(e) => setAd(e.target.value)} className="field" placeholder="Video 2" maxLength={80} />
          </Field>
        </div>
        <div className="break-all rounded-field bg-canvas px-3 py-2 font-mono text-xs">{url}</div>
        <Button
          size="sm"
          variant="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              toast('Havola nusxalandi');
            } catch {
              toast("Nusxalab bo'lmadi", 'err');
            }
          }}
        >
          <Copy className="h-3.5 w-3.5" /> Nusxalash
        </Button>
      </div>
    </Card>
  );
}
