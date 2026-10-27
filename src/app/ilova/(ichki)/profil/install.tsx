'use client';
import { useEffect, useState } from 'react';
import { Download, Share } from 'lucide-react';

type BIP = Event & { prompt: () => Promise<void> };

/** "Ilovani o'rnatish": Android — bitta tugma, iPhone — "Ulashish → Bosh ekranga" ko'rsatmasi */
export function InstallHint() {
  const [evt, setEvt] = useState<BIP | null>(null);
  const [standalone, setStandalone] = useState(true);
  const [ios, setIos] = useState(false);
  useEffect(() => {
    setStandalone(window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const h = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIP);
    };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);
  if (standalone) return null;
  return (
    <section className="space-y-2 rounded-[24px] bg-[#C4F03C] p-4 text-[#0C1631]">
      <h2 className="font-extrabold">Ilovani telefonga o&apos;rnating</h2>
      {evt ? (
        <button type="button" onClick={() => evt.prompt()} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#0C1631] text-sm font-extrabold text-white">
          <Download className="h-4 w-4" /> O&apos;rnatish
        </button>
      ) : ios ? (
        <p className="flex items-center gap-1.5 text-[13px] font-semibold">
          Safari&apos;da <Share className="h-4 w-4" /> «Ulashish» → «Bosh ekranga qo&apos;shish» ni bosing.
        </p>
      ) : (
        <p className="text-[13px] font-semibold">Brauzer menyusidan «Ilovani o&apos;rnatish» yoki «Bosh ekranga qo&apos;shish» ni tanlang.</p>
      )}
    </section>
  );
}
