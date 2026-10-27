'use client';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, Copy, MessageSquareText, RefreshCw, Send, Smartphone, X } from 'lucide-react';
import { Badge, Button, Card, CardHeader, Empty, Field, PageHeader, cn } from '@/components/ui';
import { ActionButton, ActionForm } from '@/components/action-form';
import { useToast } from '@/components/toast';
import { cancelMessage, connectBot, markSent, retryMessages, saveTemplate } from '@/app/actions/messages';

type Row = { id: number; event: string; channel: string; to: string; body: string; status: string; error: string | null; created: string; student_id: number | null; student: string | null };
type Ev = { key: string; label: string; vars: string[]; hint: string };

const ST: Record<string, { l: string; tone: 'good' | 'warn' | 'bad' | 'info' | 'neutral' }> = {
  qolda: { l: "Qo'lda yuborish kerak", tone: 'warn' },
  navbatda: { l: 'Navbatda', tone: 'info' },
  yuborilmoqda: { l: 'Yuborilmoqda', tone: 'info' },
  yuborildi: { l: 'Yuborildi', tone: 'good' },
  xato: { l: 'Xato', tone: 'bad' },
  bekor: { l: 'Bekor', tone: 'neutral' },
};

export function MessagesView({ rows, counts, status, events, templates, channels, isBoss }: { rows: Row[]; counts: Record<string, number>; status: string; events: Ev[]; templates: Record<string, { body: string; active: boolean }>; channels: { sms: boolean; bot: boolean; botName: string | null; linked: number }; isBoss: boolean }) {
  const router = useRouter();
  const path = usePathname();
  const toast = useToast();
  const [tab, setTab] = useState<'navbat' | 'shablon'>('navbat');
  const evLabel = (k: string) => events.find((e) => e.key === k)?.label ?? k;
  const copy = async (t: string) => {
    try {
      await navigator.clipboard.writeText(t);
      toast('Nusxalandi');
    } catch {
      toast("Nusxalab bo'lmadi", 'err');
    }
  };
  return (
    <>
      <PageHeader
        title="Xabarlar"
        sub="To'lov, kelmaslik, qarz, tug'ilgan kun va birinchi dars haqida ota-onalarga avtomatik xabarlar"
        actions={
          <ActionButton variant="secondary" action={retryMessages}>
            <RefreshCw className="h-4 w-4" /> Navbatni yuborish
          </ActionButton>
        }
      />
      <div className="mb-5 grid gap-3 md:grid-cols-2">
        <Card className="flex items-start gap-3 p-4">
          <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg', channels.bot ? 'bg-good-soft text-good' : 'bg-canvas text-fg-muted')}>
            <Send className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1 text-sm">
            <div className="font-bold">Telegram bot {channels.botName && <span className="font-normal text-fg-muted">@{channels.botName}</span>}</div>
            <p className="text-[13px] text-fg-muted">
              {channels.bot ? `${channels.linked} ta o'quvchining ota-onasi ulangan. Ota-onani ulash uchun o'quvchi profilidagi "Ota-ona kabineti" havolasini yuboring.` : 'TELEGRAM_BOT_TOKEN sozlanmagan — xabarlar SMS yoki qo\'lda yuboriladi.'}
            </p>
            {channels.bot && isBoss && (
              <ActionButton variant="ghost" className="mt-1 -ml-2" action={connectBot}>
                Botni qayta ulash
              </ActionButton>
            )}
          </div>
        </Card>
        <Card className="flex items-start gap-3 p-4">
          <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg', channels.sms ? 'bg-good-soft text-good' : 'bg-canvas text-fg-muted')}>
            <Smartphone className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1 text-sm">
            <div className="font-bold">SMS (Eskiz)</div>
            <p className="text-[13px] text-fg-muted">
              {channels.sms ? 'Ulangan — Telegramga ulanmagan ota-onalarga SMS ketadi.' : "Ulanmagan. ESKIZ_EMAIL va ESKIZ_PASSWORD qo'shilsa SMS avtomatik ketadi. Hozircha xabarlar \"Qo'lda yuborish\" ro'yxatiga tushadi."}
            </p>
          </div>
        </Card>
      </div>

      <div className="mb-4 inline-flex rounded-field border border-line bg-white p-1">
        {(['navbat', 'shablon'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn('rounded-[7px] px-3.5 py-1.5 text-[13px] font-bold', tab === t ? 'bg-ink text-white' : 'text-fg-muted')}>
            {t === 'navbat' ? 'Xabarlar' : 'Shablonlar'}
          </button>
        ))}
      </div>

      {tab === 'navbat' ? (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap gap-1.5 border-b border-line px-4 py-3">
            {[['', 'Hammasi'], ['qolda', "Qo'lda"], ['xato', 'Xato'], ['navbatda', 'Navbatda'], ['yuborildi', 'Yuborildi']].map(([k, l]) => (
              <button
                key={k}
                onClick={() => router.replace(k ? `${path}?holat=${k}` : path, { scroll: false })}
                className={cn('inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold', status === k ? 'border-ink bg-ink text-white' : 'border-line bg-white text-fg-muted')}
              >
                {l}
                {k && counts[k] ? <span className="opacity-60">{counts[k]}</span> : null}
              </button>
            ))}
          </div>
          {rows.length === 0 ? (
            <Empty icon={<MessageSquareText className="h-5 w-5" />} title="Xabar yo'q" text="To'lov qabul qilinganda yoki o'quvchi darsga kelmaganda xabar shu yerda paydo bo'ladi." />
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((r) => (
                <li key={r.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
                    <span className="tnum">{r.created}</span>
                    <Badge>{evLabel(r.event)}</Badge>
                    <Badge tone={ST[r.status]?.tone}>{ST[r.status]?.l ?? r.status}</Badge>
                    <span>{r.channel === 'telegram' ? 'Telegram' : `SMS +${r.to}`}</span>
                    {r.student_id && (
                      <Link href={`/oquvchilar?id=${r.student_id}`} className="font-semibold text-fg hover:text-brand">
                        {r.student}
                      </Link>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm">{r.body}</p>
                  {r.error && <p className="mt-1 text-xs text-bad">{r.error}</p>}
                  {['qolda', 'xato', 'navbatda'].includes(r.status) && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => copy(r.body)}>
                        <Copy className="h-3.5 w-3.5" /> Nusxa
                      </Button>
                      {r.channel === 'sms' && (
                        <a href={`sms:+${r.to}?body=${encodeURIComponent(r.body)}`} className="inline-flex h-8 items-center gap-1.5 rounded-field px-2.5 text-[13px] font-bold text-brand hover:bg-brand-soft">
                          <Smartphone className="h-3.5 w-3.5" /> Telefondan yuborish
                        </a>
                      )}
                      <ActionButton variant="soft" action={() => markSent(r.id)}>
                        <Check className="h-3.5 w-3.5" /> Yubordim
                      </ActionButton>
                      <ActionButton variant="ghost" action={() => cancelMessage(r.id)}>
                        <X className="h-3.5 w-3.5" /> Bekor
                      </ActionButton>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {events.map((e) => {
            const t = templates[e.key];
            return (
              <Card key={e.key}>
                <CardHeader title={e.label} sub={e.hint} />
                <div className="px-5 pb-5">
                  {isBoss ? (
                    <ActionForm action={saveTemplate.bind(null, e.key)}>
                      <Field label="Matn" hint={`O'zgaruvchilar: ${e.vars.map((v) => `{${v}}`).join(', ')}`}>
                        <textarea name="body" rows={3} maxLength={600} defaultValue={t?.body ?? ''} className="field" required />
                      </Field>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="active" defaultChecked={t?.active ?? true} className="h-4 w-4 accent-[#0E7C6B]" /> Yoqilgan
                      </label>
                    </ActionForm>
                  ) : (
                    <p className="text-sm">{t?.body ?? '—'}</p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
