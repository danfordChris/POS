'use client';

import { useActionState } from 'react';
import { Button, ErrorCard } from '@/components/ui';
import { voidInvoice, type InvoiceActionState } from '@/app/(shell)/invoices/actions';

export function VoidInvoiceButton({
  invoiceId,
  disabled,
}: {
  invoiceId: string;
  disabled?: boolean;
}) {
  const bound = voidInvoice.bind(null, invoiceId);
  const [state, action, pending] = useActionState<InvoiceActionState, FormData>(bound, {});

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          !confirm('Void this invoice? The customer balance will be reduced by the amount due.')
        ) {
          e.preventDefault();
        }
      }}
      className="flex flex-col items-end gap-2"
    >
      <input
        type="text"
        name="reason"
        placeholder="Reason (optional)"
        className="rounded-lg border border-surface-sunken bg-surface px-3 py-1.5 text-caption"
        aria-label="Void reason"
      />
      <Button type="submit" variant="destructive" size="sm" disabled={disabled || pending}>
        {pending ? 'Voiding…' : 'Void invoice'}
      </Button>
      {state.error ? <ErrorCard code={state.error.code} title={state.error.message} /> : null}
    </form>
  );
}
