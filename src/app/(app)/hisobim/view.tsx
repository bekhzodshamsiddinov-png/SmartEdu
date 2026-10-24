'use client';
import { useState, useTransition } from 'react';
import { Copy, KeyRound, Loader2, ShieldAlert, ShieldCheck, Smartphone } from 'lucide-react';
import { Badge, Button, Card, CardHeader, Field, PageHeader } from '@/components/ui';
import { ActionButton, ActionForm } from '@/components/action-form';
import { changeMyPassword, confirm2fa, disable2fa, logoutEverywhere, start2fa } from '@/app/actions/staff';

type Login = { id: number; at: string; ip: string | null; detail: string | null };

export function AccountView({ name, phone, twoFactor, backupLeft, logins }: { name: string; phone: string; twoFactor: boolean; backupLeft: number; logins: Login[] }) {
  return (
    <>
      <PageHeader title="Mening hisobim" sub={`${name}, +${phone}`} />
      <div className="grid gap-5 lg:grid-cols-2 lg:items-start [&>*]:min-w-0">
        <div className="space-y-5">
          <TwoFactorCard enabled={twoFactor} backupLeft={backupLeft} />
          <Card>
            <CardHeader title="Parolni o'zgartirish" />
            <div className="px-5 pb-5">
              <ActionForm action={changeMyPassword} submitLabel="Parolni yangilash" resetOnSuccess>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Joriy parol">
                    <input type="password" name="current" autoComplete="current-password" className="field" required />
                  </Field>
                  <Field label="Yangi parol">
                    <input type="password" name="next" autoComplete="new-password" minLength={8} className="field" required />
                  </Field>
                </div>
              </ActionForm>
              <p className="mt-3 text-xs text-fg-muted">Kamida 8 belgi, harf va raqam aralash. Parol almashsa, boshqa qurilmalardan avtomatik chiqiladi.</p>
            </div>
          </Card>
        </div>
        <Card>
          <CardHeader
            title="Oxirgi kirishlar"
            sub="Tanimagan kirish bo'lsa — parolni almashtiring va boshqa qurilmalardan chiqing"
            action={
              <ActionButton variant="secondary" size="sm" action={logoutEverywhere} confirm="Boshqa barcha telefon va kompyuterlardan chiqilsinmi?">
                Boshqa qurilmalardan chiqish
              </ActionButton>
            }
          />
          <ul className="divide-y divide-line border-t border-line">
            {logins.length === 0 && <li className="px-5 py-6 text-center text-sm text-fg-muted">Hozircha yozuv yo&apos;q</li>}
            {logins.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="tnum font-semibold">{l.at}</span>
                <span className="min-w-0 truncate text-right text-xs text-fg-muted">
                  {l.detail ? `${l.detail} · ` : ''}IP {l.ip ?? '—'}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

function TwoFactorCard({ enabled, backupLeft }: { enabled: boolean; backupLeft: number }) {
  const [setup, setSetup] = useState<{ qr: string; secret: string } | null>(null);
  const [backup, setBackup] = useState<string[] | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [showDisable, setShowDisable] = useState(false);

  if (backup) {
    return (
      <Card>
        <CardHeader title="Zaxira kodlarni saqlab qo'ying" sub="Telefon yo'qolsa shu kodlar bilan kirasiz. Har biri bir marta ishlaydi. Ular boshqa ko'rsatilmaydi." />
        <div className="px-5 pb-5">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-canvas p-4 font-mono text-[15px] font-bold tracking-wider">
            {backup.map((b) => (
              <span key={b}>{b}</span>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => navigator.clipboard?.writeText(backup.join('\n'))}>
              <Copy className="h-4 w-4" /> Nusxalash
            </Button>
            <Button onClick={() => location.reload()}>Saqladim</Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Ikki bosqichli kirish"
        sub="Parol o'g'irlansa ham, telefoningizsiz hisobga kirib bo'lmaydi"
        action={<Badge tone={enabled ? 'good' : 'warn'}>{enabled ? 'Yoqilgan' : "O'chirilgan"}</Badge>}
      />
      <div className="space-y-4 px-5 pb-5">
        {enabled ? (
          <>
            <div className="flex items-start gap-3 rounded-xl bg-good-soft px-4 py-3 text-sm text-good">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
              <span>Har kirishda telefoningizdagi ilova kodi so&apos;raladi. Zaxira kodlar: {backupLeft} ta qoldi.</span>
            </div>
            {showDisable ? (
              <ActionForm action={disable2fa} submitLabel="O'chirish" danger onCancel={() => setShowDisable(false)}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Parolingiz">
                    <input type="password" name="password" autoComplete="current-password" className="field" required />
                  </Field>
                  <Field label="Ilovadagi kod">
                    <input name="code" inputMode="numeric" autoComplete="one-time-code" className="field font-mono tracking-widest" required />
                  </Field>
                </div>
              </ActionForm>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setShowDisable(true)}>
                O&apos;chirish
              </Button>
            )}
          </>
        ) : setup ? (
          <>
            <ol className="space-y-1.5 text-sm text-fg-muted">
              <li>1. Telefonga <b className="text-fg">Google Authenticator</b> yoki <b className="text-fg">Microsoft Authenticator</b> ilovasini o&apos;rnating.</li>
              <li>2. Ilovada &quot;+&quot; → &quot;QR kodni skanerlash&quot; ni bosib, quyidagi kodni skanerlang.</li>
              <li>3. Ilovada chiqqan 6 xonali kodni pastga yozing.</li>
            </ol>
            <div className="flex flex-col items-center gap-3 rounded-xl border border-line p-4 sm:flex-row">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={setup.qr} alt="2FA QR kodi" width={168} height={168} className="h-[168px] w-[168px] rounded-lg bg-white p-1" />
              <div className="min-w-0 text-xs text-fg-muted">
                QR ishlamasa, ilovaga shu kalitni qo&apos;lda kiriting:
                <div className="mt-1 break-all font-mono text-[13px] font-bold text-fg">{setup.secret}</div>
              </div>
            </div>
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                start(async () => {
                  const r = await confirm2fa(code);
                  if (r.ok) setBackup(r.backup);
                  else setError(r.error);
                });
              }}
            >
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6 xonali kod"
                aria-label="Tasdiqlash kodi"
                className="field font-mono tracking-widest sm:flex-1"
                required
              />
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />} Yoqish
              </Button>
            </form>
            {error && <p className="rounded-field bg-bad-soft px-3 py-2 text-sm font-medium text-bad">{error}</p>}
          </>
        ) : (
          <>
            <div className="flex items-start gap-3 rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <span>Hozir faqat parol himoya qilyapti. Rahbar, administrator va hisobchi uchun ikki bosqichli kirishni yoqish tavsiya etiladi.</span>
            </div>
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const r = await start2fa();
                  if (r.ok) setSetup({ qr: r.qr, secret: r.secret });
                  else setError(r.error);
                })
              }
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />} Yoqish
            </Button>
            {error && <p className="rounded-field bg-bad-soft px-3 py-2 text-sm font-medium text-bad">{error}</p>}
            <p className="flex items-center gap-1.5 text-xs text-fg-muted">
              <KeyRound className="h-3.5 w-3.5" /> Sizga 8 ta zaxira kod ham beriladi.
            </p>
          </>
        )}
      </div>
    </Card>
  );
}
