'use client';
import { useState } from 'react';
import { Ban } from 'lucide-react';
import { Button, Field } from '@/components/ui';
import { Modal } from '@/components/modal';
import { ActionForm } from '@/components/action-form';
import { cancelPayment } from '@/app/actions/payments';
import { money } from '@/lib/format';

/** To'lovni bekor qilish (sabab bilan). To'lov o'chirilmaydi — tarixda "bekor qilingan" bo'lib qoladi. */
export function CancelPaymentButton({ id, amount, who }: { id: number; amount: number; who: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)} title="Bekor qilish" aria-label="To'lovni bekor qilish">
        <Ban className="h-4 w-4" />
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="To'lovni bekor qilish" size="sm">
        {open && (
          <ActionForm action={cancelPayment.bind(null, id)} submitLabel="Bekor qilish" danger onDone={() => setOpen(false)} onCancel={() => setOpen(false)}>
            <p className="text-sm text-fg-muted">
              {who}: <b className="text-fg">{money(amount)}</b>. To&apos;lov o&apos;chirilmaydi — tarixda belgi bilan qoladi va hisobotlardan chiqadi.
            </p>
            <Field label="Sabab">
              <input name="reason" className="field" placeholder="Masalan: summa xato kiritilgan" required minLength={3} />
            </Field>
          </ActionForm>
        )}
      </Modal>
    </>
  );
}
