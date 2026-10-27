import { BrandMark } from '@/components/brand-mark';
import { getSettings } from '@/lib/settings';
import { KeyRound, QrCode, ShieldCheck, Wallet } from 'lucide-react';

export const metadata = { title: 'Ilovaga ulanish' };

export default async function Connect({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const s = await getSettings();
  return (
    <div className="mx-auto max-w-md px-5 pb-10 pt-[calc(28px+env(safe-area-inset-top))]">
      <BrandMark className="h-14 w-14" />
      <h1 className="mt-5 text-[30px] font-extrabold leading-[1.1] tracking-[-0.02em]">
        Farzandingizning o&apos;qishi — <span className="text-[#D93A08]">cho&apos;ntagingizda</span>
      </h1>
      <p className="mt-3 text-[15px] text-[#5B6478]">{s.centerName} ota-onalar ilovasi.</p>
      {sp.xato && (
        <p className="mt-5 rounded-2xl bg-[#FBE9E7] px-4 py-3 text-sm font-semibold text-[#C23B3B]">
          {sp.xato === '2' ? "Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring." : 'Havola eskirgan yoki noto\'g\'ri. Administratordan yangi havola so\'rang.'}
        </p>
      )}
      <div className="mt-6 grid gap-2.5">
        {[
          { I: Wallet, t: "Balans va to'lovlar", c: '#D93A08' },
          { I: QrCode, t: 'QR bilan darsga kirish', c: '#0C1631' },
          { I: ShieldCheck, t: 'Davomat, baholar, coinlar', c: '#1878AE' },
        ].map(({ I, t, c }) => (
          <div key={t} className="flex items-center gap-3 rounded-[20px] bg-white p-3.5">
            <span className="grid h-10 w-10 place-items-center rounded-xl text-white" style={{ background: c }}>
              <I className="h-5 w-5" />
            </span>
            <span className="font-bold">{t}</span>
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-[24px] bg-[#0C1631] p-5 text-white">
        <div className="flex items-center gap-2 font-extrabold">
          <KeyRound className="h-5 w-5 text-[#C4F03C]" /> Qanday ulanaman?
        </div>
        <p className="mt-2 text-sm text-white/70">Markaz administratori sizga Telegram yoki SMS orqali shaxsiy havola yuboradi. Havolani shu telefonda oching — ilova avtomatik ochiladi.</p>
        {s.phone && (
          <a href={`tel:+${s.phone}`} className="mt-4 flex h-12 items-center justify-center rounded-2xl bg-[#D93A08] text-sm font-extrabold">
            Administratorga qo&apos;ng&apos;iroq qilish
          </a>
        )}
      </div>
    </div>
  );
}
