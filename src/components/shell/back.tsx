'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/components/ui';

const KEY = 'nav-stack';

function read(): string[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(-30) : [];
  } catch {
    return [];
  }
}
function write(s: string[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(s.slice(-30)));
  } catch {}
}

/** Sahifalar tarixini (faqat shu ilova ichida) eslab boradi: orqaga qaytilsa — oxirgisi olib tashlanadi */
export function useNavStack() {
  const path = usePathname();
  useEffect(() => {
    const s = read();
    if (s[s.length - 1] === path) return;
    if (s[s.length - 2] === path) s.pop();
    else s.push(path);
    write(s);
  }, [path]);
}

/** Yuqori satrdagi "Orqaga" tugmasi: oldingi sahifaga, tarix bo'lmasa — bir pog'ona yuqoriga */
export function BackButton({ home = '/', className }: { home?: string; className?: string }) {
  const path = usePathname();
  const router = useRouter();
  if (path === home) return null;
  function back() {
    const s = read();
    if (s.length > 1 && s[s.length - 1] === path) {
      router.back();
      return;
    }
    const up = path.split('/').slice(0, -1).join('/') || home;
    router.push(up.length < home.length ? home : up);
  }
  return (
    <button
      type="button"
      onClick={back}
      className={cn('inline-flex h-10 shrink-0 items-center gap-1.5 rounded-field border border-line bg-white px-2.5 text-sm font-bold text-fg hover:bg-canvas sm:px-3', className)}
      aria-label="Orqaga"
      title="Orqaga"
    >
      <ArrowLeft className="h-4 w-4" />
      <span className="hidden sm:inline">Orqaga</span>
    </button>
  );
}
