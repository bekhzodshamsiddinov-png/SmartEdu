'use client';
import dynamic from 'next/dynamic';

/** Grafik kutubxonasi (~90 kB) sahifa ochilgandan keyin yuklanadi — birinchi ochilish tezlashadi */
const Skeleton = ({ height }: { height: number }) => <div className="animate-pulse rounded-xl bg-canvas" style={{ height: height + 30 }} aria-hidden />;

export const MoneyBars = dynamic(() => import('./money-bars').then((m) => m.MoneyBars), {
  ssr: false,
  loading: () => <Skeleton height={260} />,
});
export const DayBars = dynamic(() => import('./day-bars').then((m) => m.DayBars), {
  ssr: false,
  loading: () => <Skeleton height={220} />,
});
