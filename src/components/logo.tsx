export function Logo({ light }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden>
        <rect width="34" height="34" rx="9" fill={light ? '#fff' : '#0F2A2E'} />
        <path d="M9 21.5c2.2 2 5 3 8 3 4.2 0 7-1.9 7-4.8 0-6-13-3.4-13-8.6 0-1.8 2-3.1 5.2-3.1 2.4 0 4.5.7 6.2 2" stroke={light ? '#0E7C6B' : '#7CE0C8'} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      </svg>
      <span className={`text-lg font-extrabold tracking-[-0.02em] ${light ? 'text-white' : 'text-fg'}`}>SmartEdu</span>
    </div>
  );
}

