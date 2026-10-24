'use client';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card mx-auto mt-10 max-w-lg p-6 text-center">
      <h2 className="text-lg font-bold">Sahifani yuklab bo&apos;lmadi</h2>
      <p className="mt-1 text-sm text-fg-muted">Ma&apos;lumotlar bazasiga ulanishni tekshiring va qayta urinib ko&apos;ring.</p>
      {error.digest && <p className="mt-2 text-xs text-fg-faint">Kod: {error.digest}</p>}
      <button onClick={reset} className="mt-4 inline-flex h-10 items-center rounded-field bg-brand px-4 text-sm font-bold text-white">
        Qayta urinish
      </button>
    </div>
  );
}
