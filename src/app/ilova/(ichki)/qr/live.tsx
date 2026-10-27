'use client';
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { ShieldCheck, Sun } from 'lucide-react';

const b64u = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

/** Har 30 soniyada yangilanadigan davomat QR kodi (internetsiz ham ishlaydi) */
export function QrLive({ sid, name, k, serverNow, windowMs }: { sid: number; name: string; k: string; serverNow: number; windowMs: number }) {
  const [img, setImg] = useState<string | null>(null);
  const [left, setLeft] = useState(windowMs);
  const offset = useRef(serverNow - Date.now());
  const keyRef = useRef<CryptoKey | null>(null);
  const lastWin = useRef(-1);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setInterval>;
    (async () => {
      keyRef.current = await crypto.subtle.importKey('raw', fromB64u(k), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const tick = async () => {
        const now = Date.now() + offset.current;
        const win = Math.floor(now / windowMs);
        setLeft(windowMs - (now % windowMs));
        if (win === lastWin.current || !keyRef.current) return;
        lastWin.current = win;
        const sig = b64u(await crypto.subtle.sign('HMAC', keyRef.current, new TextEncoder().encode(`${sid}.${win}`))).slice(0, 22);
        const url = await QRCode.toDataURL(`SE2.${sid}.${win}.${sig}`, { errorCorrectionLevel: 'M', margin: 1, width: 640, color: { dark: '#0C1631', light: '#FFFFFF' } });
        if (alive) setImg(url);
      };
      await tick();
      timer = setInterval(tick, 250);
    })();
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [k, sid, windowMs]);

  const pc = left / windowMs;
  return (
    <div className="space-y-4 pb-4">
      <section className="rounded-[28px] bg-white p-5 text-center">
        <h1 className="text-xl font-extrabold">Darsga kirish kodi</h1>
        <p className="mt-1 text-sm text-[#5B6478]">O&apos;qituvchiga ko&apos;rsating — u skanerlaydi</p>
        <div className="relative mx-auto mt-5 aspect-square w-full max-w-[300px]">
          <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden>
            <rect x="2" y="2" width="96" height="96" rx="14" fill="none" stroke="#F2F4F9" strokeWidth="3" />
            <rect x="2" y="2" width="96" height="96" rx="14" fill="none" stroke={pc < 0.2 ? '#D93A08' : '#C4F03C'} strokeWidth="3" pathLength={100} strokeDasharray={`${pc * 100} 100`} strokeLinecap="round" />
          </svg>
          <div className="absolute inset-[7%] grid place-items-center overflow-hidden rounded-2xl bg-white">
            {img ? <img src={img} alt={`${name} — davomat QR kodi`} className="h-full w-full [image-rendering:pixelated]" /> : <div className="h-full w-full animate-pulse rounded-2xl bg-[#F2F4F9]" />}
          </div>
        </div>
        <div className="mt-4 text-lg font-extrabold">{name}</div>
        <div className="mt-1 text-sm font-bold tabular-nums text-[#5B6478]">{Math.ceil(left / 1000)} soniyadan keyin yangilanadi</div>
      </section>
      <div className="grid grid-cols-2 gap-2.5 text-[13px]">
        <div className="flex items-start gap-2 rounded-[20px] bg-white p-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#1E8A4C]" /> Kod har 30 soniyada o&apos;zgaradi, skrinshot ishlamaydi
        </div>
        <div className="flex items-start gap-2 rounded-[20px] bg-white p-3">
          <Sun className="mt-0.5 h-4 w-4 shrink-0 text-[#D93A08]" /> Ekran yorqinligini oshiring — tezroq o&apos;qiladi
        </div>
      </div>
    </div>
  );
}
