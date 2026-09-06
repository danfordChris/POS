'use client';

import { useActionState } from 'react';
import { Button, ErrorCard } from '@/components/ui';
import { voidSale, type VoidState } from '@/app/(shell)/sales/actions';

export function VoidSaleButton({ saleId, disabled }: { saleId: string; disabled?: boolean }) {
  const bound = voidSale.bind(null, saleId);
  const [state, action, pending] = useActionState<VoidState, FormData>(bound, {});

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm('Void this sale? Stock will be returned and the receipt voided.')) {
          e.preventDefault();
        }
      }}
      className="flex flex-col gap-3"
    >
      <Button type="submit" variant="destructive" size="sm" disabled={disabled || pending}>
        {pending ? 'Voiding…' : 'Void sale'}
      </Button>
      {state.error ? <ErrorCard code={state.error.code} title={state.error.message} /> : null}
    </form>
  );
}
