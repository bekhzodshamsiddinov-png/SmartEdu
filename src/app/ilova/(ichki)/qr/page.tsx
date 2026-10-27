import { redirect } from 'next/navigation';
import { currentChild } from '@/lib/family';
import { QR_WINDOW, studentQrKey } from '@/lib/qr';
import { QrLive } from './live';

export const metadata = { title: 'QR davomat' };
export const dynamic = 'force-dynamic';

export default async function QrPage() {
  const child = await currentChild();
  if (!child) redirect('/ilova/ulanish');
  return <QrLive sid={child.id} name={child.name} k={studentQrKey(child.id, child.cabinetHash)} serverNow={Date.now()} windowMs={QR_WINDOW} />;
}
