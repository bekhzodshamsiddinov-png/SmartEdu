import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-4 text-center">
      <div>
        <div className="text-5xl font-extrabold tracking-tight text-brand">404</div>
        <h1 className="mt-3 text-xl font-bold">Sahifa topilmadi</h1>
        <Link href="/" className="mt-5 inline-flex h-10 items-center rounded-field bg-brand px-4 text-sm font-bold text-white">
          Bosh sahifaga qaytish
        </Link>
      </div>
    </div>
  );
}
