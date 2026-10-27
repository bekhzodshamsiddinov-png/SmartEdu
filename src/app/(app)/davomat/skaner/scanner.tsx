'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import jsQR from 'jsqr';
import { ArrowLeft, Camera, CheckCircle2, Clock, ScanLine, XCircle } from 'lucide-react';
import { cn } from '@/components/ui';
import { scanAttendanceQr } from '@/app/actions/attendance';

type M = { id: number; name: string; status: string | null };
type Ev = { t: number; ok: boolean; text: string; tone: 'good' | 'warn' | 'bad' };

/** O'qituvchi telefoni kamerasi bilan o'quvchilarning QR kodini skanerlash */
export function Scanner({ group, members }: { group: { id: number; name: string; course: string; time: string }; members: M[] }) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [on, setOn] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [list, setList] = useState(members);
  const [events, setEvents] = useState<Ev[]>([]);
  const [flash, setFlash] = useState<Ev | null>(null);
  const busy = useRef(false);
  const seen = useRef(new Map<string, number>());

  const handle = useCallback(
    async (code: string) => {
      const last = seen.current.get(code);
      if (busy.current || (last && Date.now() - last < 4000)) return;
      seen.current.set(code, Date.now());
      busy.current = true;
      try {
        const r = await scanAttendanceQr(group.id, code);
        const ev: Ev = r.ok
          ? { t: Date.now(), ok: true, text: `${r.name}: ${r.already ? 'allaqachon belgilangan' : r.status === 'kechikdi' ? 'kechikdi' : 'keldi'}`, tone: r.status === 'kechikdi' ? 'warn' : 'good' }
          : { t: Date.now(), ok: false, text: r.error, tone: 'bad' };
        if (r.ok) setList((l) => l.map((m) => (m.id === r.id ? { ...m, status: r.status } : m)));
        setEvents((e) => [ev, ...e].slice(0, 30));
        setFlash(ev);
        if (navigator.vibrate) navigator.vibrate(r.ok ? 60 : [40, 60, 40]);
        setTimeout(() => setFlash((f) => (f === ev ? null : f)), 1800);
      } finally {
        busy.current = false;
      }
    },
    [group.id],
  );

  useEffect(() => {
    if (!on) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stop = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false });
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        const ctx = canvas.current!.getContext('2d', { willReadFrequently: true })!;
        let lastScan = 0;
        const tick = (ts: number) => {
          if (stop) return;
          if (ts - lastScan > 220 && v.readyState === v.HAVE_ENOUGH_DATA) {
            lastScan = ts;
            const w = 480;
            const h = Math.round((v.videoHeight / v.videoWidth) * w) || 360;
            canvas.current!.width = w;
            canvas.current!.height = h;
            ctx.drawImage(v, 0, 0, w, h);
            const img = ctx.getImageData(0, 0, w, h);
            const code = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
            if (code?.data?.startsWith('SE2.')) void handle(code.data);
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        setErr("Kameraga ruxsat berilmadi yoki kamera topilmadi. Brauzer sozlamalarida kameraga ruxsat bering.");
        setOn(false);
      }
    })();
    return () => {
      stop = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [on, handle]);

  const came = list.filter((m) => m.status === 'keldi' || m.status === 'kechikdi').length;

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-4 flex items-center gap-3">
        <Link href={`/davomat?guruh=${group.id}`} className="grid h-10 w-10 place-items-center rounded-field border border-line bg-white" aria-label="Orqaga">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-extrabold">QR davomat · {group.name}</h1>
          <p className="text-[13px] text-fg-muted">
            {group.course}, {group.time} · keldi {came}/{list.length}
          </p>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[24px] bg-[#0C1631] shadow-lift">
        <video ref={video} playsInline muted className={cn('aspect-[3/4] w-full object-cover sm:aspect-video', !on && 'hidden')} />
        <canvas ref={canvas} className="hidden" />
        {!on && (
          <div className="grid aspect-[3/4] place-items-center p-8 text-center text-white sm:aspect-video">
            <div>
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white/10">
                <ScanLine className="h-8 w-8 text-[#C4F03C]" />
              </div>
              <p className="mt-4 text-lg font-extrabold">O&apos;quvchilar ilovadagi QR kodni ko&apos;rsatadi</p>
              <p className="mt-1 text-sm text-white/60">Kod har 30 soniyada yangilanadi — skrinshot ishlamaydi.</p>
              {err && <p className="mt-3 rounded-xl bg-[#D93A08]/20 px-3 py-2 text-sm text-[#FFC9A8]">{err}</p>}
              <button onClick={() => { setErr(null); setOn(true); }} className="mt-5 inline-flex h-12 items-center gap-2 rounded-full bg-[#D93A08] px-6 text-[15px] font-extrabold text-white">
                <Camera className="h-5 w-5" /> Kamerani yoqish
              </button>
            </div>
          </div>
        )}
        {on && (
          <>
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="h-56 w-56 rounded-[28px] border-4 border-[#C4F03C]/80 shadow-[0_0_0_9999px_rgba(12,22,49,0.35)]" />
            </div>
            <button onClick={() => setOn(false)} className="absolute right-3 top-3 rounded-full bg-black/50 px-3 py-1.5 text-xs font-bold text-white">
              To&apos;xtatish
            </button>
          </>
        )}
        {flash && (
          <div className={cn('absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-white', flash.tone === 'good' ? 'bg-[#1E8A4C]' : flash.tone === 'warn' ? 'bg-[#B8681A]' : 'bg-[#C23B3B]')} role="status">
            {flash.ok ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />} {flash.text}
          </div>
        )}
      </div>

      <div className="card mt-4">
        <div className="border-b border-line px-4 py-3 text-sm font-bold">Guruh ro&apos;yxati</div>
        <ul className="divide-y divide-line">
          {list.map((m) => (
            <li key={m.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span>{m.name}</span>
              {m.status === 'keldi' ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-good"><CheckCircle2 className="h-3.5 w-3.5" /> Keldi</span>
              ) : m.status === 'kechikdi' ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-warn"><Clock className="h-3.5 w-3.5" /> Kechikdi</span>
              ) : (
                <span className="text-xs text-fg-faint">{m.status === 'kelmadi' ? 'Kelmadi' : m.status === 'sababli' ? 'Sababli' : 'Kutilmoqda'}</span>
              )}
            </li>
          ))}
        </ul>
        <p className="border-t border-line px-4 py-3 text-xs text-fg-muted">Skanerlanmaganlarni darsdan keyin oddiy davomatda belgilang.</p>
      </div>
      {events.length > 0 && (
        <div className="mt-4 space-y-1 text-xs text-fg-muted">
          {events.map((e) => (
            <div key={e.t} className={e.ok ? '' : 'text-bad'}>
              {new Date(e.t).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} — {e.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
