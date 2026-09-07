'use client';

import { useActionState } from 'react';
import { Button, Card, ErrorCard, TextField } from '@/components/ui';
import { recordPayment, type InvoiceActionState } from '@/app/(shell)/invoices/actions';

export function RecordPaymentForm({
  invoiceId,
  balanceDue,
  currency,
}: {
  invoiceId: string;
  balanceDue: number;
  currency: string;
}) {
  const bound = recordPayment.bind(null, invoiceId);
  const [state, action, pending] = useActionState<InvoiceActionState, FormData>(bound, {});

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-h3 font-semibold">Record a payment</h2>
        <p className="text-caption text-text-secondary">
          Balance due {currency} {balanceDue.toLocaleString('en-US')}.
        </p>
      </div>
      <form action={action} className="grid gap-3 sm:grid-cols-2">
        <TextField
          name="amount_minor"
          type="number"
          min={1}
          max={balanceDue}
          defaultValue={balanceDue}
          aria-label="Amount"
          required
        />
        <select
          name="method"
          className="rounded-lg border border-surface-sunken bg-surface px-3 py-2 text-body"
          aria-label="Method"
          defaultValue="cash"
        >
          <option value="cash">Cash</option>
          <option value="bank_transfer">Bank transfer</option>
          <option value="mobile_money">Mobile money</option>
          <option value="other">Other</option>
        </select>
        <TextField
          name="reference"
          placeholder="Reference (optional)"
          aria-label="Reference"
          className="sm:col-span-2"
        />
        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? 'Recording…' : 'Record payment'}
          </Button>
        </div>
      </form>
      {state.error ? <ErrorCard code={state.error.code} title={state.error.message} /> : null}
      {state.ok ? <p className="text-caption text-success">Payment recorded.</p> : null}
    </Card>
  );
}
