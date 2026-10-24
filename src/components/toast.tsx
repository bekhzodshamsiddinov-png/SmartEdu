'use client';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

type T = { id: number; text: string; tone: 'ok' | 'err' };
const Ctx = createContext<(text: string, tone?: 'ok' | 'err') => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const push = useCallback((text: string, tone: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, text, tone }]);
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), tone === 'err' ? 6000 : 3200);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[80] flex flex-col items-center gap-2 px-4 lg:bottom-6" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            className="anim-pop pointer-events-auto flex max-w-md items-start gap-2.5 rounded-xl bg-ink px-4 py-3 text-sm font-medium text-white shadow-pop"
          >
            {t.tone === 'ok' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#7CE0C8]" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#FF9C8F]" />
            )}
            <span className="flex-1">{t.text}</span>
            <button onClick={() => setItems((s) => s.filter((x) => x.id !== t.id))} aria-label="Yopish" className="opacity-60 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
